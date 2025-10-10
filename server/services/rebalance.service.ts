/**
 * Rebalancing Service
 * Handles automated position rebalancing with volatility-adjusted dynamic ranges
 */

import { PublicKey, Transaction, Keypair } from "@solana/web3.js";
import BN from "bn.js";
import { config } from "../config";
import { logger } from "../utils/logger";
import { RebalanceParams, RebalanceResult, ApiResponse } from "../types";
import { RebalanceError, ValidationError } from "../utils/errors";
import { DLMMService } from "./dlmm.service";
import { VolatilityService } from "./volatility.service";

export class RebalanceService {
  private dlmmService: DLMMService;
  private volatilityService: VolatilityService;

  constructor() {
    this.dlmmService = new DLMMService();
    this.volatilityService = new VolatilityService();
    logger.info("Rebalance Service initialized");
  }

  /**
   * Rebalance a position with volatility-adjusted dynamic ranges
   */
  async rebalancePosition(
    params: RebalanceParams,
    signerKeypair: Keypair
  ): Promise<ApiResponse<RebalanceResult>> {
    try {
      logger.info("Starting position rebalance", {
        position: params.positionKey.toString(),
        targetVolatility: params.targetVolatility,
      });

      // Validate parameters
      this.validateRebalanceParams(params);

      // Get current position metrics
      const positionMetrics = await this.dlmmService.getPositionMetrics(
        params.positionKey.toString()
      );

      if (!positionMetrics.data) {
        throw new RebalanceError("Position not found");
      }

      const position = positionMetrics.data.position;
      const pool = position.pool;

      // Calculate current volatility
      const volatilityResponse =
        await this.volatilityService.calculateVolatility(pool.toString());

      if (!volatilityResponse.data) {
        throw new RebalanceError("Failed to calculate volatility");
      }

      const currentVolatility = volatilityResponse.data.volatility;

      // Calculate new range based on volatility
      const activeBinId = await this.dlmmService.getActiveBinId(
        pool.toString()
      );
      const newRange = this.calculateDynamicRange(
        activeBinId,
        currentVolatility,
        params.targetVolatility
      );

      const oldRange = {
        lower: position.lowerBinId,
        upper: position.upperBinId,
      };

      logger.info("Calculated new range", {
        oldRange,
        newRange,
        currentVolatility: currentVolatility.toFixed(4),
        targetVolatility: params.targetVolatility.toFixed(4),
      });

      // Check if rebalance is needed
      if (
        newRange.lower === oldRange.lower &&
        newRange.upper === oldRange.upper
      ) {
        logger.info("No rebalance needed, range unchanged");
        return {
          success: true,
          data: {
            success: true,
            oldRange,
            newRange,
            liquidityAdjusted: new BN(0),
            timestamp: Date.now(),
          },
          timestamp: Date.now(),
        };
      }

      // Execute rebalance transaction
      // Pass liquidity amount if this is automated rebalancing
      const automatedLiquidity = (params as any).liquidityToTransfer;
      const result = await this.executeRebalance(
        position.publicKey,
        pool,
        newRange,
        params.slippageBps,
        signerKeypair,
        automatedLiquidity
      );

      logger.info("Rebalance completed", {
        position: params.positionKey.toString(),
        txSignature: result.txSignature,
      });

      return {
        success: true,
        data: result,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error("Rebalance failed", {
        position: params.positionKey.toString(),
        error: error.message,
      });

      if (error instanceof RebalanceError || error instanceof ValidationError) {
        throw error;
      }

      throw new RebalanceError("Rebalance execution failed", {
        originalError: error.message,
      });
    }
  }

  /**
   * Calculate dynamic range based on volatility
   */
  private calculateDynamicRange(
    activeBinId: number,
    currentVolatility: number,
    targetVolatility: number
  ): { lower: number; upper: number } {
    // Adjust range width based on volatility ratio
    const volatilityRatio = currentVolatility / targetVolatility;

    // Base range width (in bins)
    const baseWidth = 20;

    // Adjust width: higher volatility = wider range
    const adjustedWidth = Math.floor(baseWidth * Math.sqrt(volatilityRatio));

    // Ensure minimum and maximum width
    const minWidth = 10;
    const maxWidth = 100;
    const finalWidth = Math.max(minWidth, Math.min(maxWidth, adjustedWidth));

    // Calculate symmetric range around active bin
    const halfWidth = Math.floor(finalWidth / 2);

    return {
      lower: activeBinId - halfWidth,
      upper: activeBinId + halfWidth,
    };
  }

  /**
   * Execute rebalance transaction
   * For automated rebalancing: removes liquidity from old position and creates new one
   * For manual rebalancing: creates new position, user manages liquidity separately
   */
  private async executeRebalance(
    positionKey: PublicKey,
    poolKey: PublicKey,
    newRange: { lower: number; upper: number },
    slippageBps: number,
    signerKeypair: Keypair,
    automatedLiquidityTransfer?: BN
  ): Promise<RebalanceResult> {
    try {
      if (automatedLiquidityTransfer) {
        // AUTOMATED REBALANCING: Full liquidity transfer flow
        logger.info("Executing automated rebalance with liquidity transfer", {
          positionKey: positionKey.toString(),
          liquidityToTransfer: automatedLiquidityTransfer.toString(),
        });

        // TODO: Integrate with Saros DLMM SDK for automated flow
        // 1. Remove ALL liquidity from old position
        // const dlmm = await DLMM.create(connection, poolKey);
        // const removeLiquidityTx = await dlmm.removeLiquidity({
        //   position: positionKey,
        //   user: signerKeypair.publicKey,
        //   binLiquidityRemoval: [...], // Remove all bins
        //   shouldClaimAndClose: true,
        // });
        //
        // 2. Create new position with removed liquidity
        // const addLiquidityTx = await dlmm.addLiquidity({
        //   position: newPositionKey,
        //   user: signerKeypair.publicKey,
        //   totalXAmount: removedXAmount,
        //   totalYAmount: removedYAmount,
        //   strategy: {
        //     minBinId: newRange.lower,
        //     maxBinId: newRange.upper,
        //     strategyType: StrategyType.SpotBalanced,
        //   },
        // });
        //
        // 3. Execute both transactions atomically or in sequence

        // Placeholder for automated flow
        const mockTxSignature = "automated_rebalance_" + Date.now();

        return {
          success: true,
          oldRange: { lower: 0, upper: 0 },
          newRange,
          liquidityAdjusted: automatedLiquidityTransfer,
          txSignature: mockTxSignature,
          timestamp: Date.now(),
        };
      } else {
        // MANUAL REBALANCING: Just create new position, user handles liquidity
        logger.info("Executing manual rebalance (new position only)", {
          positionKey: positionKey.toString(),
        });

        // This creates a new empty position with the new range
        // User will manually add liquidity via the UI
        // Placeholder implementation
        const mockTxSignature = "manual_rebalance_" + Date.now();

        return {
          success: true,
          oldRange: { lower: 0, upper: 0 },
          newRange,
          liquidityAdjusted: new BN(0),
          txSignature: mockTxSignature,
          timestamp: Date.now(),
        };
      }
    } catch (error: any) {
      logger.error("Failed to execute rebalance transaction", {
        error: error.message,
      });

      return {
        success: false,
        oldRange: { lower: 0, upper: 0 },
        newRange,
        liquidityAdjusted: new BN(0),
        error: error.message,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Validate rebalance parameters
   */
  private validateRebalanceParams(params: RebalanceParams): void {
    if (params.targetVolatility < config.rebalancing.minVolatilityThreshold) {
      throw new ValidationError(
        `Target volatility too low: ${params.targetVolatility}`,
        { min: config.rebalancing.minVolatilityThreshold }
      );
    }

    if (params.targetVolatility > config.rebalancing.maxVolatilityThreshold) {
      throw new ValidationError(
        `Target volatility too high: ${params.targetVolatility}`,
        { max: config.rebalancing.maxVolatilityThreshold }
      );
    }

    if (params.slippageBps > config.rebalancing.maxSlippageBps) {
      throw new ValidationError(
        `Slippage too high: ${params.slippageBps} bps`,
        { max: config.rebalancing.maxSlippageBps }
      );
    }

    if (params.slippageBps < 0) {
      throw new ValidationError("Slippage cannot be negative");
    }
  }

  /**
   * Check if position needs rebalancing
   */
  async needsRebalancing(
    positionKey: string,
    targetVolatility: number,
    threshold: number = 0.1
  ): Promise<boolean> {
    try {
      const positionMetrics =
        await this.dlmmService.getPositionMetrics(positionKey);

      if (!positionMetrics.data) {
        return false;
      }

      const pool = positionMetrics.data.position.pool;
      const volatilityResponse =
        await this.volatilityService.calculateVolatility(pool.toString());

      if (!volatilityResponse.data) {
        return false;
      }

      const currentVolatility = volatilityResponse.data.volatility;
      const volatilityDiff = Math.abs(currentVolatility - targetVolatility);

      // Rebalance if volatility difference exceeds threshold
      return volatilityDiff / targetVolatility > threshold;
    } catch (error: any) {
      logger.error("Failed to check rebalancing need", {
        position: positionKey,
        error: error.message,
      });
      return false;
    }
  }
}
