/**
 * Strategy Simulator Service
 * Simulates DLMM strategies with historical or synthetic data
 */

import BN from 'bn.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  SimulationParams,
  SimulationResult,
  SimulationSnapshot,
  PricePoint,
  ApiResponse,
} from '../types';
import { ValidationError } from '../utils/errors';

export class SimulatorService {
  /**
   * Run strategy simulation
   */
  async runSimulation(
    params: SimulationParams
  ): Promise<ApiResponse<SimulationResult>> {
    try {
      logger.info('Starting strategy simulation', {
        duration: params.duration,
        rebalanceFrequency: params.rebalanceFrequency,
      });

      // Validate parameters
      this.validateSimulationParams(params);

      // Generate price path based on volatility
      const pricePath = this.generatePricePath(
        params.duration,
        params.volatilityTarget
      );

      // Run simulation
      const result = await this.simulate(params, pricePath);

      logger.info('Simulation completed', {
        totalReturn: result.totalReturn.toFixed(4),
        rebalanceCount: result.rebalanceCount,
      });

      return {
        success: true,
        data: result,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error('Simulation failed', {
        error: error.message,
      });

      if (error instanceof ValidationError) {
        throw error;
      }

      throw new Error(`Simulation failed: ${error.message}`);
    }
  }

  /**
   * Simulate strategy execution
   */
  private async simulate(
    params: SimulationParams,
    pricePath: PricePoint[]
  ): Promise<SimulationResult> {
    const timeline: SimulationSnapshot[] = [];
    let currentLiquidity = params.initialLiquidity;
    let totalFeesEarned = 0;
    let rebalanceCount = 0;
    let maxDrawdown = 0;
    let peakValue = 0;

    // Initial range
    let currentRange = params.priceRange;
    const initialPrice = pricePath[0].price;
    let initialValue = this.calculatePositionValue(
      currentLiquidity,
      initialPrice,
      currentRange
    );

    // Track when to rebalance
    const rebalanceIntervalHours = params.rebalanceFrequency;
    let hoursSinceLastRebalance = 0;

    for (let i = 0; i < pricePath.length; i++) {
      const point = pricePath[i];
      const inRange =
        point.price >= currentRange.lower && point.price <= currentRange.upper;

      // Calculate fees earned (only when in range)
      if (inRange) {
        const hourlyFee = this.calculateHourlyFee(
          currentLiquidity,
          point.price,
          params.feeRate
        );
        totalFeesEarned += hourlyFee;
      }

      // Calculate current value
      const currentValue = this.calculatePositionValue(
        currentLiquidity,
        point.price,
        currentRange
      );

      // Track drawdown
      if (currentValue > peakValue) {
        peakValue = currentValue;
      }
      const drawdown = (peakValue - currentValue) / peakValue;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      // Check if rebalance is needed
      hoursSinceLastRebalance++;
      if (hoursSinceLastRebalance >= rebalanceIntervalHours) {
        // Rebalance: adjust range based on current price
        currentRange = this.calculateOptimalRange(
          point.price,
          params.volatilityTarget
        );
        rebalanceCount++;
        hoursSinceLastRebalance = 0;

        logger.debug('Rebalancing in simulation', {
          hour: i,
          price: point.price,
          newRange: currentRange,
        });
      }

      // Record snapshot
      timeline.push({
        timestamp: point.timestamp,
        price: point.price,
        liquidity: currentLiquidity,
        value: currentValue,
        feesAccumulated: totalFeesEarned,
        inRange,
      });
    }

    const finalValue =
      timeline[timeline.length - 1]?.value || initialValue;
    const totalReturn = (finalValue - initialValue) / initialValue;

    // Calculate Sharpe Ratio
    const returns = this.calculateReturnsFromTimeline(timeline);
    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) /
        returns.length
    );
    const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

    return {
      totalReturn,
      feesEarned: totalFeesEarned,
      rebalanceCount,
      maxDrawdown,
      sharpeRatio,
      finalValue,
      timeline,
    };
  }

  /**
   * Generate synthetic price path
   */
  private generatePricePath(
    durationHours: number,
    volatility: number
  ): PricePoint[] {
    const path: PricePoint[] = [];
    const startPrice = 100; // Base price
    const hourMs = 3600000;
    const now = Date.now();

    // Geometric Brownian Motion parameters
    const dt = 1 / 24; // 1 hour in days
    const drift = 0; // Assume no drift for simplicity
    const vol = volatility;

    let price = startPrice;

    for (let i = 0; i < durationHours; i++) {
      // GBM: dS = μ*S*dt + σ*S*dW
      const randomShock = this.randomNormal(0, 1);
      const priceChange =
        drift * price * dt + vol * price * Math.sqrt(dt) * randomShock;

      price = Math.max(price + priceChange, 1); // Ensure price stays positive

      path.push({
        timestamp: now + i * hourMs,
        price,
      });
    }

    return path;
  }

  /**
   * Calculate optimal range based on price and volatility
   */
  private calculateOptimalRange(
    currentPrice: number,
    volatility: number
  ): { lower: number; upper: number } {
    // Range width based on volatility (e.g., ±2 standard deviations)
    const rangeWidth = currentPrice * volatility * 2;

    return {
      lower: currentPrice - rangeWidth / 2,
      upper: currentPrice + rangeWidth / 2,
    };
  }

  /**
   * Calculate position value
   */
  private calculatePositionValue(
    liquidity: BN,
    price: number,
    range: { lower: number; upper: number }
  ): number {
    // Simplified calculation
    // In reality, this would depend on bin distribution and liquidity concentration
    const liquidityValue = liquidity.toNumber() / 1e9; // Assuming 9 decimals

    // If price is in range, full value; otherwise, partial value
    if (price >= range.lower && price <= range.upper) {
      return liquidityValue * price;
    } else {
      // Out of range: value decreases
      return liquidityValue * price * 0.5;
    }
  }

  /**
   * Calculate hourly fee earnings
   */
  private calculateHourlyFee(
    liquidity: BN,
    price: number,
    feeRateBps: number
  ): number {
    // Simplified fee calculation
    // Assume some base trading volume and calculate fees
    const liquidityValue = liquidity.toNumber() / 1e9;
    const hourlyVolume = liquidityValue * 0.1; // 10% of liquidity trades per hour (assumption)
    const feeRate = feeRateBps / 10000;

    return hourlyVolume * feeRate;
  }

  /**
   * Calculate returns from timeline
   */
  private calculateReturnsFromTimeline(
    timeline: SimulationSnapshot[]
  ): number[] {
    const returns: number[] = [];

    for (let i = 1; i < timeline.length; i++) {
      const prevValue = timeline[i - 1].value;
      const currentValue = timeline[i].value;
      const returnPct = (currentValue - prevValue) / prevValue;
      returns.push(returnPct);
    }

    return returns;
  }

  /**
   * Generate random normal distribution value (Box-Muller transform)
   */
  private randomNormal(mean: number, stdDev: number): number {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
  }

  /**
   * Validate simulation parameters
   */
  private validateSimulationParams(params: SimulationParams): void {
    if (params.duration <= 0) {
      throw new ValidationError('Duration must be positive');
    }

    if (params.rebalanceFrequency <= 0) {
      throw new ValidationError('Rebalance frequency must be positive');
    }

    if (params.rebalanceFrequency > params.duration) {
      throw new ValidationError(
        'Rebalance frequency cannot exceed duration'
      );
    }

    if (params.volatilityTarget < 0 || params.volatilityTarget > 2) {
      throw new ValidationError(
        'Volatility target must be between 0 and 2'
      );
    }

    if (params.feeRate < 0 || params.feeRate > 10000) {
      throw new ValidationError('Fee rate must be between 0 and 10000 bps');
    }

    if (params.priceRange.lower >= params.priceRange.upper) {
      throw new ValidationError(
        'Price range lower bound must be less than upper bound'
      );
    }
  }
}
