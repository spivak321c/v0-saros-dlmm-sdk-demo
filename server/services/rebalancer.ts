import { Keypair, PublicKey } from "@solana/web3.js";
import { dlmmClient } from "../solana/dlmm-client";
import storage from "../storage";
import { volatilityTracker } from "./volatility-tracker";
import { feeOptimizer } from "../utils/fee-optimizer";
import { telegramBot } from "./telegram-bot";
import type { RebalanceEvent, RebalanceParams } from "../../shared/schema";

export class Rebalancer {
  private rebalancingInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 300000; // 5 minutes

  async shouldRebalance(
    positionAddress: string,
    threshold: number = 5
  ): Promise<boolean> {
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
    const finalBinCount = 16; // Fixed per position
    const half = Math.floor((finalBinCount - 1) / 2); // 7
    const lowerBinId = currentBinId - half; // e.g., -7
    const upperBinId = currentBinId + (finalBinCount - 1 - half); // e.g., +8

    const calculatedBinCount = upperBinId - lowerBinId + 1;
    if (calculatedBinCount !== finalBinCount)
      throw new Error(`Bin count mismatch: ${calculatedBinCount}`);

    const relativeLeft = lowerBinId - currentBinId;
    const relativeRight = upperBinId - currentBinId;
    if (relativeLeft >= 0 || relativeRight <= 0)
      throw new Error(
        `Invalid relatives: left=${relativeLeft}, right=${relativeRight}`
      );

    console.log("Calculated optimal range (16 bins)", {
      currentBinId,
      lowerBinId,
      upperBinId,
      relativeLeft,
      relativeRight,
    });

    return { lowerBinId, upperBinId };
  }

  async executeRebalance(
    params: RebalanceParams,
    owner: Keypair
  ): Promise<RebalanceEvent> {
    const positionData = storage.getPosition(params.positionAddress);
    if (!positionData) {
      throw new Error("Position not found");
    }

    console.log("\n=== REBALANCE EXECUTION START ===");
    console.log("Position:", params.positionAddress);
    console.log("Pool active bin ID:", positionData.pool.activeId);
    console.log("Old range:", {
      lower: positionData.position.lowerBinId,
      upper: positionData.position.upperBinId,
    });
    console.log("New range:", {
      lower: params.newLowerBinId,
      upper: params.newUpperBinId,
    });
    console.log("New range relative to active:", {
      relativeLower: params.newLowerBinId - positionData.pool.activeId,
      relativeUpper: params.newUpperBinId - positionData.pool.activeId,
    });
    console.log(
      "Bin array index (from lower):",
      Math.floor(params.newLowerBinId / 70)
    );
    console.log("Range width:", params.newUpperBinId - params.newLowerBinId);
    console.log("=== REBALANCE EXECUTION START ===\n");

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

      // Send Telegram notification
      await telegramBot.sendRebalanceAlert(event);

      // Add alert
      storage.addAlert({
        id: `alert_${Date.now()}`,
        type: "success",
        title: "Position Rebalanced",
        message: `Position ${params.positionAddress.slice(0, 8)}... successfully rebalanced`,
        positionAddress: params.positionAddress,
        timestamp: Date.now(),
        read: false,
      });

      return event;
    } catch (error) {
      console.error("\n=== REBALANCE EXECUTION FAILED ===");
      console.error("Position:", params.positionAddress);
      console.error(
        "Error:",
        error instanceof Error ? error.message : String(error)
      );
      console.error("=== REBALANCE EXECUTION FAILED ===\n");

      event.status = "failed";
      storage.addRebalanceEvent(event);

      // Send Telegram notification for failure
      await telegramBot.sendRebalanceAlert(event);

      storage.addAlert({
        id: `alert_${Date.now()}`,
        type: "error",
        title: "Rebalance Failed",
        message: `Failed to rebalance position: ${error instanceof Error ? error.message : "Unknown error"}`,
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
      const shouldRebal = await this.shouldRebalance(
        positionData.position.address,
        threshold
      );

      if (shouldRebal) {
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

        try {
          await this.executeRebalance(params, owner);
        } catch (error) {
          console.error(
            `Failed to rebalance position ${positionData.position.address}:`,
            error
          );
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

    console.log("Auto-rebalancing started");
  }

  stopAutoRebalancing() {
    if (this.rebalancingInterval) {
      clearInterval(this.rebalancingInterval);
      this.rebalancingInterval = null;
      console.log("Auto-rebalancing stopped");
    }
  }
}

export const rebalancer = new Rebalancer();
