/**
 * Stop-Loss Service
 * Monitors positions and executes stop-loss when thresholds are breached
 */

import { PublicKey, Keypair } from '@solana/web3.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  StopLossConfig,
  StopLossEvent,
  ApiResponse,
} from '../types';
import { ValidationError } from '../utils/errors';
import { DLMMService } from './dlmm.service';

export class StopLossService {
  private dlmmService: DLMMService;
  private activeConfigs: Map<string, StopLossConfig>;
  private monitoringInterval: NodeJS.Timeout | null;

  constructor() {
    this.dlmmService = new DLMMService();
    this.activeConfigs = new Map();
    this.monitoringInterval = null;
    logger.info('Stop-Loss Service initialized');
  }

  /**
   * Register a stop-loss configuration for a position
   */
  async registerStopLoss(
    stopLossConfig: StopLossConfig
  ): Promise<ApiResponse<StopLossConfig>> {
    try {
      logger.info('Registering stop-loss', {
        position: stopLossConfig.positionKey.toString(),
        threshold: stopLossConfig.threshold,
      });

      // Validate configuration
      this.validateStopLossConfig(stopLossConfig);

      // Store configuration
      const key = stopLossConfig.positionKey.toString();
      this.activeConfigs.set(key, stopLossConfig);

      // Start monitoring if not already running
      if (!this.monitoringInterval && stopLossConfig.enabled) {
        this.startMonitoring();
      }

      logger.info('Stop-loss registered', {
        position: key,
        activeCount: this.activeConfigs.size,
      });

      return {
        success: true,
        data: stopLossConfig,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error('Failed to register stop-loss', {
        position: stopLossConfig.positionKey.toString(),
        error: error.message,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new Error(`Failed to register stop-loss: ${error.message}`);
    }
  }

  /**
   * Unregister a stop-loss configuration
   */
  async unregisterStopLoss(
    positionKey: string
  ): Promise<ApiResponse<boolean>> {
    try {
      logger.info('Unregistering stop-loss', { position: positionKey });

      const removed = this.activeConfigs.delete(positionKey);

      // Stop monitoring if no active configs
      if (this.activeConfigs.size === 0 && this.monitoringInterval) {
        this.stopMonitoring();
      }

      return {
        success: true,
        data: removed,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error('Failed to unregister stop-loss', {
        position: positionKey,
        error: error.message,
      });

      throw new Error(`Failed to unregister stop-loss: ${error.message}`);
    }
  }

  /**
   * Check a specific position for stop-loss trigger
   */
  async checkStopLoss(
    positionKey: string,
    signerKeypair?: Keypair
  ): Promise<ApiResponse<StopLossEvent>> {
    try {
      logger.debug('Checking stop-loss', { position: positionKey });

      const config = this.activeConfigs.get(positionKey);
      if (!config) {
        throw new ValidationError('Stop-loss not configured for position');
      }

      // Get position metrics
      const metricsResponse = await this.dlmmService.getPositionMetrics(
        positionKey
      );

      if (!metricsResponse.data) {
        throw new Error('Failed to fetch position metrics');
      }

      const metrics = metricsResponse.data;
      const currentLoss = -metrics.unrealizedPnL / metrics.currentValue;

      // Check if threshold is breached
      const triggered = currentLoss >= config.threshold;

      let executed = false;
      let txSignature: string | undefined;

      if (triggered && config.enabled) {
        logger.warn('Stop-loss triggered', {
          position: positionKey,
          currentLoss: currentLoss.toFixed(4),
          threshold: config.threshold.toFixed(4),
        });

        if (!config.notifyOnly && signerKeypair) {
          // Execute stop-loss: remove liquidity
          const result = await this.executeStopLoss(
            config.positionKey,
            signerKeypair
          );
          executed = result.success;
          txSignature = result.txSignature;
        }
      }

      const event: StopLossEvent = {
        positionKey: config.positionKey,
        currentLoss,
        threshold: config.threshold,
        triggered,
        executed,
        txSignature,
        timestamp: Date.now(),
      };

      return {
        success: true,
        data: event,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error('Failed to check stop-loss', {
        position: positionKey,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Execute stop-loss: remove all liquidity from position
   */
  private async executeStopLoss(
    positionKey: PublicKey,
    signerKeypair: Keypair
  ): Promise<{ success: boolean; txSignature?: string }> {
    try {
      logger.info('Executing stop-loss', {
        position: positionKey.toString(),
      });

      // TODO: Integrate with Saros DLMM SDK
      // const dlmm = await DLMM.create(connection, poolAddress);
      // const removeLiquidityTx = await dlmm.removeLiquidity({
      //   position: positionKey,
      //   user: signerKeypair.publicKey,
      //   binLiquidityRemoval: [...], // Remove all bins
      //   shouldClaimAndClose: true,
      // });
      //
      // const txSignature = await connection.sendTransaction(removeLiquidityTx, [signerKeypair]);
      // await connection.confirmTransaction(txSignature);

      // Placeholder
      const mockTxSignature = 'stop_loss_tx_' + Date.now();

      logger.info('Stop-loss executed', {
        position: positionKey.toString(),
        txSignature: mockTxSignature,
      });

      return {
        success: true,
        txSignature: mockTxSignature,
      };
    } catch (error: any) {
      logger.error('Failed to execute stop-loss', {
        position: positionKey.toString(),
        error: error.message,
      });

      return {
        success: false,
      };
    }
  }

  /**
   * Start monitoring all active stop-loss configurations
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) {
      return;
    }

    logger.info('Starting stop-loss monitoring', {
      interval: config.stopLoss.checkIntervalMs,
    });

    this.monitoringInterval = setInterval(async () => {
      await this.monitorAllPositions();
    }, config.stopLoss.checkIntervalMs);
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Stopped stop-loss monitoring');
    }
  }

  /**
   * Monitor all active positions
   */
  private async monitorAllPositions(): Promise<void> {
    logger.debug('Monitoring all positions', {
      count: this.activeConfigs.size,
    });

    for (const [positionKey, config] of this.activeConfigs.entries()) {
      if (!config.enabled) {
        continue;
      }

      try {
        await this.checkStopLoss(positionKey);
      } catch (error: any) {
        logger.error('Error monitoring position', {
          position: positionKey,
          error: error.message,
        });
      }
    }
  }

  /**
   * Validate stop-loss configuration
   */
  private validateStopLossConfig(config: StopLossConfig): void {
    if (config.threshold <= 0 || config.threshold > 1) {
      throw new ValidationError(
        'Stop-loss threshold must be between 0 and 1'
      );
    }
  }

  /**
   * Get all active stop-loss configurations
   */
  getActiveConfigs(): StopLossConfig[] {
    return Array.from(this.activeConfigs.values());
  }

  /**
   * Cleanup: stop monitoring and clear configs
   */
  cleanup(): void {
    this.stopMonitoring();
    this.activeConfigs.clear();
    logger.info('Stop-loss service cleaned up');
  }
}
