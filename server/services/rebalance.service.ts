/**
 * Rebalancing Service
 * Simple, clean rebalancing logic for DLMM positions
 */

import { PublicKey, Transaction } from "@solana/web3.js";
import { logger } from "../utils/logger";
import { dlmmClient } from "../solana/dlmm-client";
import storage from "../storage";
import { ApiResponse, RebalanceParams } from "../types";

export class RebalanceService {
  /**
   * Check if a position needs rebalancing
   * Position needs rebalancing if active bin is outside the position range
   */
  async shouldRebalance(positionAddress: string): Promise<boolean> {
    try {
      logger.info("Checking if position needs rebalancing", {
        positionAddress,
      });

      const positionData = storage.getPosition(positionAddress);
      if (!positionData) {
        logger.warn("Position not found", { positionAddress });
        return false;
      }

      const { position, pool } = positionData;
      const activeBinId = pool.activeId;
      const { lowerBinId, upperBinId } = position;

      // Position needs rebalancing if active bin is outside range
      const needsRebalance =
        activeBinId <= lowerBinId || activeBinId >= upperBinId;

      logger.info("Rebalance check result", {
        positionAddress,
        activeBinId,
        lowerBinId,
        upperBinId,
        needsRebalance,
      });

      return needsRebalance;
    } catch (error) {
      logger.error("Failed to check rebalance necessity", {
        positionAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Calculate optimal bin range for rebalancing
   * Uses volatility to determine range width
   */
  calculateOptimalRange(
    poolAddress: string,
    activeBinId: number,
    volatility: number
  ): { lowerBinId: number; upperBinId: number } {
    logger.info("Calculating optimal range", {
      poolAddress,
      activeBinId,
      volatility,
    });

    // Calculate range width based on volatility
    // Low volatility (0-30): narrow range (20-40 bins)
    // Medium volatility (30-70): medium range (40-80 bins)
    // High volatility (70-100): wide range (80-120 bins)
    let rangeWidth: number;

    if (volatility < 30) {
      rangeWidth = 20 + Math.floor(volatility * 0.67); // 20-40 bins
    } else if (volatility < 70) {
      rangeWidth = 40 + Math.floor((volatility - 30) * 1.0); // 40-80 bins
    } else {
      rangeWidth = 80 + Math.floor((volatility - 70) * 1.33); // 80-120 bins
    }

    // Cap at 120 bins (leave margin below 140 max)
    rangeWidth = Math.min(rangeWidth, 120);

    // CRITICAL: Use asymmetric range to ensure active bin is strictly inside
    // Split range asymmetrically to guarantee activeBinId is NOT on boundary
    const halfWidthLeft = Math.floor(rangeWidth / 2);
    const halfWidthRight = rangeWidth - halfWidthLeft;

    const lowerBinId = activeBinId - halfWidthLeft;
    const upperBinId = activeBinId + halfWidthRight;

    // Validate: active bin must be strictly inside
    const relativeLower = lowerBinId - activeBinId;
    const relativeUpper = upperBinId - activeBinId;

    logger.info("Optimal range calculated", {
      poolAddress,
      activeBinId,
      volatility,
      rangeWidth,
      halfWidthLeft,
      halfWidthRight,
      lowerBinId,
      upperBinId,
      relativeLower,
      relativeUpper,
      validation: {
        lowerLessThanActive: lowerBinId < activeBinId,
        upperGreaterThanActive: upperBinId > activeBinId,
        relativeLowerNegative: relativeLower < 0,
        relativeUpperPositive: relativeUpper > 0,
      },
    });

    // Final validation
    if (lowerBinId >= activeBinId || upperBinId <= activeBinId) {
      logger.error(
        "CRITICAL: Calculated range does not strictly contain active bin",
        {
          lowerBinId,
          upperBinId,
          activeBinId,
        }
      );
      throw new Error(
        "Invalid range calculation: active bin not strictly inside range"
      );
    }

    return { lowerBinId, upperBinId };
  }

  /**
   * Create unsigned rebalance transaction for user approval
   */
  async createUnsignedRebalanceTransaction(params: RebalanceParams): Promise<
    ApiResponse<{
      transaction: string;
      newRange: { lowerBinId: number; upperBinId: number };
      reason: string;
    }>
  > {
    try {
      const positionAddress = params.positionKey.toString();
      logger.info("Creating unsigned rebalance transaction", {
        positionAddress,
      });

      // Get position data
      const positionData = storage.getPosition(positionAddress);
      if (!positionData) {
        throw new Error(`Position not found: ${positionAddress}`);
      }

      const { position, pool } = positionData;
      const activeBinId = pool.activeId;

      // Calculate optimal range
      const volatility = params.targetVolatility || 50; // Default to medium volatility
      const newRange = this.calculateOptimalRange(
        pool.address,
        activeBinId,
        volatility
      );

      // Determine rebalance reason
      let reason = "Position optimization";
      if (activeBinId <= position.lowerBinId) {
        reason = "Price below range";
      } else if (activeBinId >= position.upperBinId) {
        reason = "Price above range";
      }

      // Build unsigned transaction
      // Note: This is a simplified version. In production, you would:
      // 1. Call DLMM SDK to build the actual rebalance transaction
      // 2. Serialize it without signing
      // 3. Return the base64 encoded transaction

      // For now, we'll create a placeholder transaction structure
      // In real implementation, use dlmmClient to build the actual transaction
      const transaction = new Transaction();
      // TODO: Add actual rebalance instructions using DLMM SDK
      // transaction.add(...rebalanceInstructions);

      const serialized = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      });
      const base64Transaction = serialized.toString("base64");

      logger.info("Unsigned rebalance transaction created", {
        positionAddress,
        newRange,
        reason,
      });

      return {
        success: true,
        data: {
          transaction: base64Transaction,
          newRange,
          reason,
        },
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error("Failed to create unsigned rebalance transaction", {
        error: error.message,
      });

      return {
        success: false,
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }
}

// Export singleton instance
export const rebalanceService = new RebalanceService();
