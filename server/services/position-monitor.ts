import { PublicKey } from "@solana/web3.js";
import { dlmmClient } from "../solana/dlmm-client";
import storage from "../storage";
import { ilCalculator } from "../utils/il-calculator";
import { logger } from "../utils/logger";
import type { PositionData } from "../../shared/schema";

export class PositionMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 30000; // 30 seconds

  async loadPositionData(
    positionAddress: string
  ): Promise<PositionData | null> {
    try {
      logger.debug("Loading position data", { positionAddress });
      const position = await dlmmClient.getPositionInfo(
        new PublicKey(positionAddress)
      );
      if (!position) {
        logger.warn("Position not found", { positionAddress });
        return null;
      }

      const pool = await dlmmClient.getPoolInfo(
        new PublicKey(position.poolAddress)
      );
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
      const totalReturn =
        initialValue > 0
          ? ((currentValue - initialValue) / initialValue) * 100
          : null;
      const positionAge = Date.now() - position.createdAt;
      const dailyYield =
        initialValue > 0 && positionAge > 0
          ? (totalFees / initialValue) * (86400000 / positionAge) * 100
          : null;

      // Calculate impermanent loss
      const storedInitialPrice = storage.getInitialPrice(positionAddress);
      const initialPrice = storedInitialPrice || pool.currentPrice;

      // Store initial price if not exists
      if (!storedInitialPrice) {
        storage.setInitialPrice(positionAddress, pool.currentPrice);
      }

      const impermanentLoss = ilCalculator.calculateIL(
        initialPrice,
        pool.currentPrice
      );

      // Calculate risk metrics
      const isInRange =
        pool.activeId >= position.lowerBinId &&
        pool.activeId <= position.upperBinId;
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
          totalReturn: totalReturn ?? 0,
          dailyYield: dailyYield ?? 0,
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
      logger.info("Position data loaded successfully", {
        positionAddress,
        currentValue,
        isInRange,
      });
      return positionData;
    } catch (error) {
      logger.error("Failed to load position data", {
        positionAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async loadUserPositions(walletAddress: string): Promise<PositionData[]> {
    try {
      logger.info("Loading user positions", { walletAddress });
      const positions = await dlmmClient.getUserPositions(
        new PublicKey(walletAddress)
      );
      logger.info("Retrieved positions from DLMM client", {
        walletAddress,
        count: positions.length,
      });
      const positionsData: PositionData[] = [];

      for (const position of positions) {
        logger.debug("Loading position data for position", {
          positionAddress: position.address,
        });
        const data = await this.loadPositionData(position.address);
        if (data) {
          positionsData.push(data);
        }
      }

      logger.info("User positions loaded successfully", {
        walletAddress,
        totalPositions: positionsData.length,
      });
      return positionsData;
    } catch (error) {
      logger.error("Failed to load user positions", {
        walletAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  startMonitoring(walletAddresses: string[]) {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    logger.info("Starting position monitoring", {
      walletCount: walletAddresses.length,
      intervalMs: this.UPDATE_INTERVAL,
    });
    this.monitoringInterval = setInterval(async () => {
      logger.debug("Running position monitoring cycle");
      for (const address of walletAddresses) {
        await this.loadUserPositions(address);
      }
    }, this.UPDATE_INTERVAL);

    logger.info("Position monitoring started successfully");
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("Position monitoring stopped");
    }
  }
}

export const positionMonitor = new PositionMonitor();
