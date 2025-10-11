/**
 * Automation Service
 * Handles scheduled automated tasks like rebalancing and monitoring
 */

import { PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { config } from "../config";
import { logger } from "../utils/logger";
import {
  AutomationJob,
  AutomationResult,
  RebalanceParams,
  ApiResponse,
} from "../types";
import { ValidationError } from "../utils/errors";
import { RebalanceService } from "./rebalance.service";
import { StopLossService } from "./stoploss.service";
import { DLMMService } from "./dlmm.service";
import { transactionQueueService } from "./transaction-queue.service";
import { telegramBot } from "./telegram-bot";
import storage from "../storage";

export class AutomationService {
  private rebalanceService: RebalanceService;
  private stopLossService: StopLossService;
  private dlmmService: DLMMService;
  private jobs: Map<string, AutomationJob>;
  private intervals: Map<string, NodeJS.Timeout>;

  constructor() {
    this.rebalanceService = new RebalanceService();
    this.stopLossService = new StopLossService();
    this.dlmmService = new DLMMService();
    this.jobs = new Map();
    this.intervals = new Map();
    logger.info("Automation Service initialized");
  }

  /**
   * Register an automation job
   */
  async registerJob(job: AutomationJob): Promise<ApiResponse<AutomationJob>> {
    try {
      logger.info("Registering automation job", {
        id: job.id,
        type: job.type,
        position: job.positionKey.toString(),
      });

      // Validate job
      this.validateJob(job);

      // Store job
      this.jobs.set(job.id, job);

      // Schedule job if enabled
      if (job.enabled) {
        await this.scheduleJob(job);
      }

      logger.info("Automation job registered", {
        id: job.id,
        enabled: job.enabled,
      });

      return {
        success: true,
        data: job,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error("Failed to register automation job", {
        id: job.id,
        error: error.message,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new Error(`Failed to register job: ${error.message}`);
    }
  }

  /**
   * Unregister an automation job
   */
  async unregisterJob(jobId: string): Promise<ApiResponse<boolean>> {
    try {
      logger.info("Unregistering automation job", { id: jobId });

      // Cancel scheduled interval
      this.cancelJob(jobId);

      // Remove job
      const removed = this.jobs.delete(jobId);

      return {
        success: true,
        data: removed,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error("Failed to unregister automation job", {
        id: jobId,
        error: error.message,
      });

      throw new Error(`Failed to unregister job: ${error.message}`);
    }
  }

  /**
   * Execute a job manually
   */
  async executeJob(
    jobId: string,
    signerKeypair: Keypair
  ): Promise<ApiResponse<AutomationResult>> {
    try {
      logger.info("Executing automation job", { id: jobId });

      const job = this.jobs.get(jobId);
      if (!job) {
        throw new ValidationError(`Job not found: ${jobId}`);
      }

      const result = await this.runJob(job, signerKeypair);

      // Update last run time
      job.lastRun = Date.now();
      this.jobs.set(jobId, job);

      return {
        success: true,
        data: result,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error("Failed to execute automation job", {
        id: jobId,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Schedule a job for automatic execution
   */
  private async scheduleJob(job: AutomationJob): Promise<void> {
    // Cancel existing interval if any
    this.cancelJob(job.id);

    let intervalMs: number;

    switch (job.type) {
      case "rebalance":
        intervalMs = config.automation.rebalanceIntervalMs;
        break;
      case "monitor":
      case "stop-loss":
        intervalMs = config.automation.monitoringIntervalMs;
        break;
      default:
        throw new ValidationError(`Unknown job type: ${job.type}`);
    }

    logger.info("Scheduling job", {
      id: job.id,
      type: job.type,
      intervalMs,
    });

    const interval = setInterval(async () => {
      try {
        logger.debug("Auto-checking job", { id: job.id });

        // Check if action is needed and queue transaction for approval
        await this.checkAndQueueTransaction(job);

        job.lastRun = Date.now();
        job.nextRun = Date.now() + intervalMs;
        this.jobs.set(job.id, job);
      } catch (error: any) {
        logger.error("Error in scheduled job check", {
          id: job.id,
          error: error.message,
        });
      }
    }, intervalMs);

    this.intervals.set(job.id, interval);

    // Set next run time
    job.nextRun = Date.now() + intervalMs;
    this.jobs.set(job.id, job);
  }

  /**
   * Cancel a scheduled job
   */
  private cancelJob(jobId: string): void {
    const interval = this.intervals.get(jobId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(jobId);
      logger.debug("Cancelled job interval", { id: jobId });
    }
  }

  /**
   * Run a job based on its type
   */
  private async runJob(
    job: AutomationJob,
    signerKeypair: Keypair
  ): Promise<AutomationResult> {
    const startTime = Date.now();

    try {
      let action: string;
      let details: Record<string, any> = {};

      switch (job.type) {
        case "rebalance":
          action = "rebalance";
          // Rebalancing is now handled via transaction queue
          // This case should not be reached in normal operation
          logger.warn(
            "Direct rebalance execution attempted, should use transaction queue",
            {
              positionAddress: job.positionKey.toString(),
            }
          );
          details = {
            message: "Rebalancing requires user approval via transaction queue",
          };
          break;

        case "stop-loss":
          action = "stop-loss-check";
          const stopLossResult = await this.stopLossService.checkStopLoss(
            job.positionKey.toString(),
            signerKeypair
          );
          details = stopLossResult.data || {};
          break;

        case "monitor":
          action = "monitor";
          const metricsResult = await this.dlmmService.getPositionMetrics(
            job.positionKey.toString()
          );
          details = metricsResult.data || {};
          break;

        default:
          throw new ValidationError(`Unknown job type: ${job.type}`);
      }

      logger.info("Job executed successfully", {
        id: job.id,
        action,
        duration: Date.now() - startTime,
      });

      return {
        jobId: job.id,
        success: true,
        action,
        details,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error("Job execution failed", {
        id: job.id,
        error: error.message,
      });

      return {
        jobId: job.id,
        success: false,
        action: job.type,
        details: {},
        timestamp: Date.now(),
        error: error.message,
      };
    }
  }

  /**
   * Validate automation job
   */
  private validateJob(job: AutomationJob): void {
    if (!job.id || job.id.trim() === "") {
      throw new ValidationError("Job ID is required");
    }

    if (!["rebalance", "monitor", "stop-loss"].includes(job.type)) {
      throw new ValidationError(`Invalid job type: ${job.type}`);
    }

    if (!job.positionKey) {
      throw new ValidationError("Position key is required");
    }
  }

  /**
   * Get all registered jobs
   */
  getJobs(): AutomationJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get a specific job
   */
  getJob(jobId: string): AutomationJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Enable a job
   */
  async enableJob(jobId: string): Promise<ApiResponse<AutomationJob>> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new ValidationError(`Job not found: ${jobId}`);
    }

    job.enabled = true;
    this.jobs.set(jobId, job);

    await this.scheduleJob(job);

    return {
      success: true,
      data: job,
      timestamp: Date.now(),
    };
  }

  /**
   * Disable a job
   */
  async disableJob(jobId: string): Promise<ApiResponse<AutomationJob>> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new ValidationError(`Job not found: ${jobId}`);
    }

    job.enabled = false;
    this.jobs.set(jobId, job);

    this.cancelJob(jobId);

    return {
      success: true,
      data: job,
      timestamp: Date.now(),
    };
  }

  /**
   * Check if action is needed and queue transaction for user approval
   */
  private async checkAndQueueTransaction(job: AutomationJob): Promise<void> {
    try {
      switch (job.type) {
        case "rebalance":
          await this.checkRebalanceAndQueue(job);
          break;
        case "stop-loss":
          await this.checkStopLossAndQueue(job);
          break;
        case "monitor":
          // Monitoring doesn't queue transactions, just logs
          await this.dlmmService.getPositionMetrics(job.positionKey.toString());
          break;
      }
    } catch (error: any) {
      logger.error("Failed to check and queue transaction", {
        jobId: job.id,
        error: error.message,
      });
    }
  }

  /**
   * Check if rebalance is needed and queue transaction
   */
  private async checkRebalanceAndQueue(job: AutomationJob): Promise<void> {
    const positionAddress = job.positionKey.toString();
    const rebalanceParams = job.config as RebalanceParams;

    const shouldRebalance =
      await this.rebalanceService.shouldRebalance(positionAddress);

    if (!shouldRebalance) {
      logger.debug("Position does not need rebalancing", { positionAddress });
      return;
    }

    logger.info("Position needs rebalancing, preparing transaction", {
      positionAddress,
    });

    try {
      // Get position data from storage
      const positionData = storage.getPosition(positionAddress);
      if (!positionData) {
        logger.error("Position not found in storage", { positionAddress });
        return;
      }

      // Create unsigned rebalance transaction
      const unsignedTx =
        await this.rebalanceService.createUnsignedRebalanceTransaction(
          rebalanceParams
        );

      if (!unsignedTx.success || !unsignedTx.data) {
        logger.error("Failed to create unsigned rebalance transaction", {
          positionAddress,
        });
        return;
      }

      // Deserialize the base64 transaction string to Transaction object
      const transactionBuffer = Buffer.from(
        unsignedTx.data.transaction,
        "base64"
      );
      const transaction = Transaction.from(transactionBuffer);

      // Queue the transaction for user approval
      const queuedTransaction = await transactionQueueService.queueTransaction(
        "rebalance",
        positionAddress,
        positionData.position.owner,
        transaction,
        {
          poolAddress: positionData.pool.address,
          oldRange: {
            lowerBinId: positionData.position.lowerBinId,
            upperBinId: positionData.position.upperBinId,
          },
          newRange: unsignedTx.data.newRange,
          reason: unsignedTx.data.reason || "Position out of range",
          estimatedValue: positionData.currentValue,
        }
      );

      // Send Telegram notification
      await telegramBot.sendTransactionApprovalAlert(
        queuedTransaction.id,
        "rebalance",
        positionAddress,
        queuedTransaction.metadata
      );

      logger.info("Rebalance transaction queued and notifications sent", {
        transactionId: queuedTransaction.id,
        positionAddress,
      });
    } catch (error: any) {
      logger.error("Error in checkRebalanceAndQueue", {
        positionAddress,
        error: error.message,
      });
    }
  }

  /**
   * Check if stop loss is triggered and queue transaction
   */
  private async checkStopLossAndQueue(job: AutomationJob): Promise<void> {
    const positionAddress = job.positionKey.toString();

    // TODO: Check stop loss condition and queue transaction if triggered
    logger.debug("Checking stop loss", { positionAddress });
  }

  /**
   * Cleanup: cancel all jobs and clear state
   */
  cleanup(): void {
    logger.info("Cleaning up automation service");

    for (const jobId of this.intervals.keys()) {
      this.cancelJob(jobId);
    }

    this.jobs.clear();
    this.intervals.clear();

    logger.info("Automation service cleaned up");
  }
}
