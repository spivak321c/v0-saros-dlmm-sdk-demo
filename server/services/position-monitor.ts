import { PublicKey } from '@solana/web3.js';
import { dlmmClient } from '../solana/dlmm-client';
import { storage } from '../storage';
import { ilCalculator } from '../utils/il-calculator';
import type { PositionData } from '../../shared/schema';

export class PositionMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 30000; // 30 seconds

  async loadPositionData(positionAddress: string): Promise<PositionData | null> {
    try {
      const position = await dlmmClient.getPositionInfo(new PublicKey(positionAddress));
      if (!position) return null;

      const pool = await dlmmClient.getPoolInfo(new PublicKey(position.poolAddress));
      if (!pool) return null;

      // Calculate current value
      const liquidityX = parseFloat(position.liquidityX);
      const liquidityY = parseFloat(position.liquidityY);
      const currentValue = liquidityX + liquidityY * pool.currentPrice;

      // Calculate fees earned
      const feeX = parseFloat(position.feeX);
      const feeY = parseFloat(position.feeY);
      const totalFees = feeX + feeY * pool.currentPrice;

      // Calculate performance metrics
      const initialValue = currentValue; // TODO: Store and retrieve initial value
      const totalReturn = ((currentValue - initialValue) / initialValue) * 100;
      const positionAge = Date.now() - position.createdAt;
      const dailyYield = (totalFees / initialValue) * (86400000 / positionAge) * 100;

      // Calculate impermanent loss
      const storedInitialPrice = storage.getInitialPrice(positionAddress);
      const initialPrice = storedInitialPrice || pool.currentPrice;
      
      // Store initial price if not exists
      if (!storedInitialPrice) {
        storage.setInitialPrice(positionAddress, pool.currentPrice);
      }
      
      const impermanentLoss = ilCalculator.calculateIL(initialPrice, pool.currentPrice);

      // Calculate risk metrics
      const isInRange = pool.activeId >= position.lowerBinId && pool.activeId <= position.upperBinId;
      const positionWidth = position.upperBinId - position.lowerBinId;
      const distanceFromPrice = Math.min(
        Math.abs(pool.activeId - position.lowerBinId),
        Math.abs(pool.activeId - position.upperBinId)
      );

      const positionData: PositionData = {
        position,
        pool,
        currentValue,
        feesEarned: {
          tokenX: feeX,
          tokenY: feeY,
          total: totalFees,
        },
        performance: {
          totalReturn,
          dailyYield,
          impermanentLoss,
        },
        riskMetrics: {
          concentration: 1 / positionWidth,
          priceDistance: distanceFromPrice / positionWidth,
          utilizationRate: liquidityX > 0 && liquidityY > 0 ? 1 : 0.5,
          isInRange,
        },
      };

      storage.setPosition(positionAddress, positionData);
      return positionData;
    } catch (error) {
      console.error(`Failed to load position ${positionAddress}:`, error);
      return null;
    }
  }

  async loadUserPositions(walletAddress: string): Promise<PositionData[]> {
    try {
      const positions = await dlmmClient.getUserPositions(new PublicKey(walletAddress));
      const positionsData: PositionData[] = [];

      for (const position of positions) {
        const data = await this.loadPositionData(position.address);
        if (data) {
          positionsData.push(data);
        }
      }

      return positionsData;
    } catch (error) {
      console.error('Failed to load user positions:', error);
      return [];
    }
  }

  startMonitoring(walletAddresses: string[]) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(async () => {
      for (const address of walletAddresses) {
        await this.loadUserPositions(address);
      }
    }, this.UPDATE_INTERVAL);

    console.log('Position monitoring started');
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Position monitoring stopped');
    }
  }


}

export const positionMonitor = new PositionMonitor();
