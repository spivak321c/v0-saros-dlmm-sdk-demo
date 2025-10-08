import { Keypair, PublicKey } from '@solana/web3.js';
import { dlmmClient } from '../solana/dlmm-client';
import { storage } from '../storage';
import { volatilityTracker } from './volatility-tracker';
import { feeOptimizer } from '../utils/fee-optimizer';
import { telegramBot } from './telegram-bot';
import type { RebalanceEvent, RebalanceParams } from '../../shared/schema';

export class Rebalancer {
  private rebalancingInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 300000; // 5 minutes

  async shouldRebalance(positionAddress: string, threshold: number = 5): Promise<boolean> {
    const positionData = storage.getPosition(positionAddress);
    if (!positionData) return false;

    const { pool, position, riskMetrics } = positionData;

    // Check if position is out of range
    if (!riskMetrics.isInRange) {
      return true;
    }

    // Check if price is close to range boundaries
    const distanceToLower = Math.abs(pool.activeId - position.lowerBinId);
    const distanceToUpper = Math.abs(pool.activeId - position.upperBinId);
    const positionWidth = position.upperBinId - position.lowerBinId;
    
    const minDistance = Math.min(distanceToLower, distanceToUpper);
    const distancePercentage = (minDistance / positionWidth) * 100;

    if (distancePercentage < threshold) {
      return true;
    }

    return false;
  }

  calculateOptimalRange(
    poolAddress: string,
    currentBinId: number,
    volatility: number
  ): { lowerBinId: number; upperBinId: number } {
    // Adjust range width based on volatility
    // Higher volatility = wider range to reduce rebalancing frequency
    const baseWidth = 100; // Base bin width
    const volatilityMultiplier = 1 + (volatility / 100);
    const width = Math.floor(baseWidth * volatilityMultiplier);

    // Ensure minimum width
    const finalWidth = Math.max(width, 50);

    return {
      lowerBinId: currentBinId - Math.floor(finalWidth / 2),
      upperBinId: currentBinId + Math.floor(finalWidth / 2),
    };
  }

  async executeRebalance(params: RebalanceParams, owner: Keypair): Promise<RebalanceEvent> {
    const positionData = storage.getPosition(params.positionAddress);
    if (!positionData) {
      throw new Error('Position not found');
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
      reason: params.reason,
      signature: '',
      status: 'pending',
    };

    try {
      // Remove liquidity from old position
      const removeTx = await dlmmClient.removeLiquidity(
        positionData.position,
        10000, // 100%
        owner
      );

      // Create new position with new range
      const createTx = await dlmmClient.createPosition(
        new PublicKey(positionData.pool.address),
        params.newLowerBinId,
        params.newUpperBinId,
        positionData.position.liquidityX,
        positionData.position.liquidityY,
        owner
      );

      event.signature = createTx;
      event.status = 'success';
      
      storage.addRebalanceEvent(event);
      
      // Send Telegram notification
      await telegramBot.sendRebalanceAlert(event);
      
      // Add alert
      storage.addAlert({
        id: `alert_${Date.now()}`,
        type: 'success',
        title: 'Position Rebalanced',
        message: `Position ${params.positionAddress.slice(0, 8)}... successfully rebalanced`,
        positionAddress: params.positionAddress,
        timestamp: Date.now(),
        read: false,
      });

      return event;
    } catch (error) {
      event.status = 'failed';
      storage.addRebalanceEvent(event);
      
      // Send Telegram notification for failure
      await telegramBot.sendRebalanceAlert(event);
      
      storage.addAlert({
        id: `alert_${Date.now()}`,
        type: 'error',
        title: 'Rebalance Failed',
        message: `Failed to rebalance position: ${error instanceof Error ? error.message : 'Unknown error'}`,
        positionAddress: params.positionAddress,
        timestamp: Date.now(),
        read: false,
      });

      throw error;
    }
  }

  async checkAndRebalancePositions(owner: Keypair, threshold: number = 5) {
    const positions = storage.getUserPositions(owner.publicKey.toString());

    for (const positionData of positions) {
      const shouldRebal = await this.shouldRebalance(positionData.position.address, threshold);
      
      if (shouldRebal) {
        const volatilityData = volatilityTracker.getVolatilityData(positionData.pool.address);
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
            ? 'Price approaching range boundary'
            : 'Position out of range',
        };

        try {
          await this.executeRebalance(params, owner);
        } catch (error) {
          console.error(`Failed to rebalance position ${positionData.position.address}:`, error);
        }
      }
    }
  }

  startAutoRebalancing(owner: Keypair, threshold: number = 5) {
    if (this.rebalancingInterval) {
      clearInterval(this.rebalancingInterval);
    }

    this.rebalancingInterval = setInterval(async () => {
      await this.checkAndRebalancePositions(owner, threshold);
    }, this.CHECK_INTERVAL);

    console.log('Auto-rebalancing started');
  }

  stopAutoRebalancing() {
    if (this.rebalancingInterval) {
      clearInterval(this.rebalancingInterval);
      this.rebalancingInterval = null;
      console.log('Auto-rebalancing stopped');
    }
  }
}

export const rebalancer = new Rebalancer();
