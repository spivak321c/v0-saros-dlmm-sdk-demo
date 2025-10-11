import { PublicKey } from "@solana/web3.js";
import { dlmmClient } from "../solana/dlmm-client";
import storage from "../storage";
import { ilCalculator } from "../utils/il-calculator";
import { logger } from "../utils/logger";
import { wsServer } from "./websocket-server";
import { telegramBot } from "./telegram-bot";
import type { PositionData, RebalanceParams } from "../../shared/schema";

export class PositionMonitor {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private rebalanceCheckInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 60000; // 60 seconds to avoid rate limiting
  private readonly REBALANCE_CHECK_INTERVAL = 300000; // 5 minutes
  private monitoredWallets: string[] = [];
  private lastUpdateTime = 0;
  private readonly MIN_UPDATE_DELAY = 2000; // Minimum 2 seconds between updates

  async loadPositionData(
    positionAddress: string,
    walletAddress?: string
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
        position: {
          ...position,
          owner: position.owner || walletAddress || "", // Ensure owner is preserved
        },
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

      logger.info("Saving position with owner", {
        positionAddress,
        owner: positionData.position.owner,
        originalOwner: position.owner,
      });
      storage.setPosition(positionAddress, positionData);
      logger.info("Position data loaded successfully", {
        positionAddress,
        currentValue,
        isInRange,
      });

      // Broadcast position update via WebSocket
      wsServer.broadcast({
        type: "position_update",
        data: positionData,
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

      // Process positions sequentially to avoid rate limiting
      for (const position of positions) {
        try {
          const data = await this.loadPositionData(
            position.address,
            walletAddress
          );
          if (data) {
            positionsData.push(data);
          }
          // Add delay between position loads to avoid rate limits
          await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          logger.warn("Failed to load position", {
            positionAddress: position.address,
            error: error instanceof Error ? error.message : String(error),
          });
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

    this.monitoredWallets = walletAddresses;

    logger.info("Starting position monitoring", {
      walletCount: walletAddresses.length,
      intervalMs: this.UPDATE_INTERVAL,
    });

    // Initial load
    (async () => {
      for (const address of walletAddresses) {
        await this.loadUserPositions(address);
      }
    })();

    // Regular monitoring with rate limiting
    this.monitoringInterval = setInterval(async () => {
      logger.debug("[Monitor] Running position monitoring cycle", {
        walletCount: walletAddresses.length,
      });
      for (const address of walletAddresses) {
        try {
          await this.loadUserPositions(address);
          // Add delay between wallet checks
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (error) {
          logger.error("[Monitor] Error in monitoring cycle", {
            address,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }, this.UPDATE_INTERVAL);

    logger.info("Position monitoring started successfully");
  }

  startAutoRebalancing(threshold: number = 5) {
    if (this.rebalanceCheckInterval) {
      clearInterval(this.rebalanceCheckInterval);
    }

    logger.info("Starting auto-rebalancing checks", {
      threshold,
      intervalMs: this.REBALANCE_CHECK_INTERVAL,
    });

    this.rebalanceCheckInterval = setInterval(async () => {
      await this.checkAndTriggerRebalances(threshold);
    }, this.REBALANCE_CHECK_INTERVAL);

    // Initial check
    this.checkAndTriggerRebalances(threshold);

    logger.info("Auto-rebalancing started successfully");
  }

  private async checkAndTriggerRebalances(threshold: number) {
    logger.debug(
      "[AutoRebalance] Checking positions for rebalancing opportunities",
      { positionCount: storage.getAllPositions().length }
    );
    const allPositions = storage.getAllPositions();

    for (const positionData of allPositions) {
      try {
        const shouldRebalance = await this.shouldRebalance(
          positionData,
          threshold
        );

        // Add delay between checks to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 500));

        if (shouldRebalance) {
          logger.info("Position needs rebalancing", {
            positionAddress: positionData.position.address,
            isInRange: positionData.riskMetrics.isInRange,
            priceDistance: positionData.riskMetrics.priceDistance,
          });

          // Create alert for rebalancing opportunity
          const alert = {
            id: `rebalance_alert_${Date.now()}_${positionData.position.address}`,
            type: "warning" as const,
            title: "Rebalance Recommended",
            message: `Position ${positionData.position.address.slice(0, 8)}... is ${positionData.riskMetrics.isInRange ? "approaching range boundary" : "out of range"}`,
            positionAddress: positionData.position.address,
            timestamp: Date.now(),
            read: false,
          };

          storage.addAlert(alert);

          // Send Telegram notification
          await telegramBot.sendAlert(alert);

          // Broadcast alert via WebSocket
          wsServer.broadcast({
            type: "alert",
            data: alert,
          });

          // Broadcast rebalance status update
          wsServer.broadcast({
            type: "rebalance_check",
            data: {
              positionAddress: positionData.position.address,
              shouldRebalance: true,
              reason: positionData.riskMetrics.isInRange
                ? "approaching_boundary"
                : "out_of_range",
              timestamp: Date.now(),
            },
          });
        }
      } catch (error) {
        logger.error("Failed to check position for rebalancing", {
          positionAddress: positionData.position.address,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async shouldRebalance(
    positionData: PositionData,
    threshold: number
  ): Promise<boolean> {
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

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info("Position monitoring stopped");
    }

    if (this.rebalanceCheckInterval) {
      clearInterval(this.rebalanceCheckInterval);
      this.rebalanceCheckInterval = null;
      logger.info("Auto-rebalancing stopped");
    }

    this.monitoredWallets = [];
  }
}

export const positionMonitor = new PositionMonitor();
