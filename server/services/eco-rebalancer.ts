import { PublicKey, Keypair } from "@solana/web3.js";
import { dlmmClient } from "../solana/dlmm-client";
import storage from "../storage";
import { volatilityTracker } from "./volatility-tracker";
import { telegramBot } from "./telegram-bot";
import type { RebalanceEvent, RebalanceParams } from "../../shared/schema";

interface BatchedRebalance {
  positionAddress: string;
  params: RebalanceParams;
  priority: number;
}

export class EcoRebalancer {
  private batchQueue: BatchedRebalance[] = [];
  private batchInterval: NodeJS.Timeout | null = null;
  private readonly BATCH_INTERVAL = 3600000; // 1 hour
  private readonly MAX_BATCH_SIZE = 5;
  private readonly MIN_PRIORITY_THRESHOLD = 50;

  /**
   * Calculate rebalance priority (0-100)
   * Higher priority = more urgent rebalance needed
   */
  calculatePriority(positionAddress: string): number {
    const positionData = storage.getPosition(positionAddress);
    if (!positionData) return 0;

    let priority = 0;

    // Out of range = highest priority
    if (!positionData.riskMetrics.isInRange) {
      priority += 50;
    }

    // Distance from price
    const distanceScore = (1 - positionData.riskMetrics.priceDistance) * 30;
    priority += distanceScore;

    // Impermanent loss severity
    const ilScore =
      Math.min(positionData.performance.impermanentLoss / 10, 1) * 20;
    priority += ilScore;

    return Math.min(priority, 100);
  }

  /**
   * Add position to batch queue if priority is high enough
   */
  queueRebalance(positionAddress: string, params: RebalanceParams): boolean {
    const priority = this.calculatePriority(positionAddress);

    if (priority < this.MIN_PRIORITY_THRESHOLD) {
      console.log(
        `Position ${positionAddress} priority too low (${priority}), skipping`
      );
      return false;
    }

    // Check if already queued
    const existingIndex = this.batchQueue.findIndex(
      (item) => item.positionAddress === positionAddress
    );

    if (existingIndex >= 0) {
      // Update existing entry if new priority is higher
      if (priority > this.batchQueue[existingIndex].priority) {
        this.batchQueue[existingIndex] = { positionAddress, params, priority };
      }
    } else {
      this.batchQueue.push({ positionAddress, params, priority });
    }

    // Sort by priority (highest first)
    this.batchQueue.sort((a, b) => b.priority - a.priority);

    console.log(
      `Queued rebalance for ${positionAddress} with priority ${priority}`
    );
    return true;
  }

  /**
   * Execute batched rebalances
   */
  async executeBatch(owner: Keypair): Promise<RebalanceEvent[]> {
    if (this.batchQueue.length === 0) {
      console.log("No rebalances in queue");
      return [];
    }

    // Take top N positions by priority
    const batch = this.batchQueue.splice(0, this.MAX_BATCH_SIZE);
    const events: RebalanceEvent[] = [];

    console.log(`Executing batch of ${batch.length} rebalances`);

    for (const item of batch) {
      try {
        const event = await this.executeRebalance(item.params, owner);
        events.push(event);
      } catch (error) {
        console.error(`Failed to rebalance ${item.positionAddress}:`, error);
      }
    }

    // Add batch completion alert
    const batchAlert = {
      id: `alert_${Date.now()}`,
      type: "info" as const,
      title: "Batch Rebalance Completed",
      message: `Processed ${events.length} positions in eco-mode`,
      timestamp: Date.now(),
      read: false,
    };
    storage.addAlert(batchAlert);
    await telegramBot.sendAlert(batchAlert);

    return events;
  }

  /**
   * Execute single rebalance (similar to regular rebalancer but optimized)
   */
  private async executeRebalance(
    params: RebalanceParams,
    owner: Keypair
  ): Promise<RebalanceEvent> {
    const positionData = storage.getPosition(params.positionAddress);
    if (!positionData) {
      throw new Error("Position not found");
    }

    const event: RebalanceEvent = {
      id: `rebalance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      positionAddress: params.positionAddress,
      timestamp: Date.now(),
      oldRange: {
        lowerBinId: positionData.position.lowerBinId,
        upperBinId: positionData.position.upperBinId,
      },
      newRange: {
        lowerBinId: params.newLowerBinId,
        upperBinId: params.newUpperBinId,
      },
      reason: `${params.reason} (eco-mode)`,
      signature: "",
      status: "pending",
    };

    try {
      // Use rebalancePosition which properly handles the transaction preparation
      const result = await dlmmClient.rebalancePosition(
        positionData.position,
        params.newLowerBinId,
        params.newUpperBinId,
        owner.publicKey
      );

      event.signature = result.positionMint;
      event.status = "success";
      storage.addRebalanceEvent(event);

      return event;
    } catch (error) {
      event.status = "failed";
      storage.addRebalanceEvent(event);
      throw error;
    }
  }

  /**
   * Check all positions and queue those needing rebalance
   */
  async checkAndQueuePositions(owner: PublicKey, threshold: number = 5) {
    const positions = storage.getUserPositions(owner.toString());

    for (const positionData of positions) {
      const shouldRebalance = await this.shouldRebalance(
        positionData.position.address,
        threshold
      );

      if (shouldRebalance) {
        const volatilityData = volatilityTracker.getVolatilityData(
          positionData.pool.address
        );
        const volatility = volatilityData?.volatility || 50;

        const newRange = this.calculateOptimalRange(
          positionData.pool.address,
          positionData.pool.activeId,
          volatility
        );

        const params: RebalanceParams = {
          positionAddress: positionData.position.address,
          newLowerBinId: newRange.lowerBinId,
          newUpperBinId: newRange.upperBinId,
          reason: positionData.riskMetrics.isInRange
            ? "Price approaching range boundary"
            : "Position out of range",
        };

        this.queueRebalance(positionData.position.address, params);
      }
    }
  }

  private async shouldRebalance(
    positionAddress: string,
    threshold: number
  ): Promise<boolean> {
    const positionData = storage.getPosition(positionAddress);
    if (!positionData) return false;

    const { pool, position, riskMetrics } = positionData;

    if (!riskMetrics.isInRange) return true;

    const distanceToLower = Math.abs(pool.activeId - position.lowerBinId);
    const distanceToUpper = Math.abs(pool.activeId - position.upperBinId);
    const positionWidth = position.upperBinId - position.lowerBinId;

    const minDistance = Math.min(distanceToLower, distanceToUpper);
    const distancePercentage = (minDistance / positionWidth) * 100;

    return distancePercentage < threshold;
  }

  private calculateOptimalRange(
    poolAddress: string,
    currentBinId: number,
    volatility: number
  ): { lowerBinId: number; upperBinId: number } {
    const baseWidth = 100;
    const volatilityMultiplier = 1 + volatility / 100;
    const width = Math.floor(baseWidth * volatilityMultiplier);

    return {
      lowerBinId: currentBinId - Math.floor(width / 2),
      upperBinId: currentBinId + Math.floor(width / 2),
    };
  }

  /**
   * Start eco-mode auto-rebalancing
   */
  startEcoMode(owner: Keypair, threshold: number = 5) {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
    }

    this.batchInterval = setInterval(async () => {
      // Check and queue positions
      await this.checkAndQueuePositions(owner.publicKey, threshold);

      // Execute batch if queue has items
      if (this.batchQueue.length > 0) {
        await this.executeBatch(owner);
      }
    }, this.BATCH_INTERVAL);

    console.log("Eco-mode rebalancing started");
  }

  /**
   * Stop eco-mode
   */
  stopEcoMode() {
    if (this.batchInterval) {
      clearInterval(this.batchInterval);
      this.batchInterval = null;
      console.log("Eco-mode rebalancing stopped");
    }
  }

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.batchQueue.length,
      topPriorities: this.batchQueue.slice(0, 5).map((item) => ({
        position: item.positionAddress,
        priority: item.priority,
      })),
      estimatedGasSavings: this.estimateGasSavings(),
    };
  }

  /**
   * Estimate gas savings from batching
   */
  private estimateGasSavings(): number {
    // Rough estimate: batching saves ~20% gas per transaction after the first
    const queueLength = this.batchQueue.length;
    if (queueLength <= 1) return 0;

    const savingsPerTx = 0.2; // 20% savings
    return (queueLength - 1) * savingsPerTx;
  }
}

export const ecoRebalancer = new EcoRebalancer();
