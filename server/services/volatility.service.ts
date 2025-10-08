/**
 * Volatility Calculation Service
 * Calculates volatility and risk metrics for DLMM positions
 */

import { PublicKey } from '@solana/web3.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import {
  VolatilityData,
  RiskMetrics,
  PricePoint,
  ApiResponse,
} from '../types';
import { InsufficientDataError } from '../utils/errors';

export class VolatilityService {
  /**
   * Calculate volatility for a pool over a given period
   */
  async calculateVolatility(
    poolKey: string,
    periodHours: number = config.volatility.defaultPeriod
  ): Promise<ApiResponse<VolatilityData>> {
    try {
      logger.info('Calculating volatility', { pool: poolKey, periodHours });

      // Fetch price history
      const priceHistory = await this.fetchPriceHistory(poolKey, periodHours);

      if (priceHistory.length < config.volatility.minDataPoints) {
        throw new InsufficientDataError(
          config.volatility.minDataPoints,
          priceHistory.length
        );
      }

      // Calculate returns
      const returns = this.calculateReturns(priceHistory);

      // Calculate statistics
      const meanReturn = this.calculateMean(returns);
      const stdDev = this.calculateStandardDeviation(returns, meanReturn);

      // Annualize volatility (assuming hourly data)
      const annualizedVolatility = stdDev * Math.sqrt(24 * 365);

      const volatilityData: VolatilityData = {
        period: periodHours,
        volatility: annualizedVolatility,
        priceChanges: returns,
        meanReturn,
        standardDeviation: stdDev,
        calculatedAt: Date.now(),
      };

      logger.info('Volatility calculated', {
        pool: poolKey,
        volatility: annualizedVolatility.toFixed(4),
      });

      return {
        success: true,
        data: volatilityData,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error('Failed to calculate volatility', {
        pool: poolKey,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Calculate comprehensive risk metrics
   */
  async calculateRiskMetrics(
    poolKey: string,
    periodHours: number = config.volatility.defaultPeriod
  ): Promise<ApiResponse<RiskMetrics>> {
    try {
      logger.info('Calculating risk metrics', { pool: poolKey, periodHours });

      const volatilityResponse = await this.calculateVolatility(
        poolKey,
        periodHours
      );
      const volatility = volatilityResponse.data!;

      const priceHistory = await this.fetchPriceHistory(poolKey, periodHours);
      const returns = this.calculateReturns(priceHistory);

      // Calculate VaR (Value at Risk) at 95% confidence
      const valueAtRisk = this.calculateVaR(
        returns,
        config.volatility.confidenceLevel
      );

      // Calculate Sharpe Ratio (assuming risk-free rate = 0 for simplicity)
      const sharpeRatio =
        volatility.standardDeviation > 0
          ? volatility.meanReturn / volatility.standardDeviation
          : 0;

      // Calculate Maximum Drawdown
      const maxDrawdown = this.calculateMaxDrawdown(priceHistory);

      // Determine risk level
      const currentRisk = this.determineRiskLevel(volatility.volatility);

      const riskMetrics: RiskMetrics = {
        volatility,
        valueAtRisk,
        sharpeRatio,
        maxDrawdown,
        currentRisk,
      };

      logger.info('Risk metrics calculated', {
        pool: poolKey,
        risk: currentRisk,
        var: valueAtRisk.toFixed(4),
      });

      return {
        success: true,
        data: riskMetrics,
        timestamp: Date.now(),
      };
    } catch (error: any) {
      logger.error('Failed to calculate risk metrics', {
        pool: poolKey,
        error: error.message,
      });

      throw error;
    }
  }

  /**
   * Fetch price history for a pool
   */
  private async fetchPriceHistory(
    poolKey: string,
    periodHours: number
  ): Promise<PricePoint[]> {
    // TODO: Integrate with price oracle or historical data source
    // For now, return mock data
    logger.debug('Fetching price history', { pool: poolKey, periodHours });

    const now = Date.now();
    const hourMs = 3600000;
    const mockData: PricePoint[] = [];

    for (let i = periodHours; i >= 0; i--) {
      mockData.push({
        timestamp: now - i * hourMs,
        price: 100 + Math.random() * 10 - 5, // Mock price around 100
      });
    }

    return mockData;
  }

  /**
   * Calculate returns from price history
   */
  private calculateReturns(priceHistory: PricePoint[]): number[] {
    const returns: number[] = [];

    for (let i = 1; i < priceHistory.length; i++) {
      const prevPrice = priceHistory[i - 1].price;
      const currentPrice = priceHistory[i].price;
      const returnPct = (currentPrice - prevPrice) / prevPrice;
      returns.push(returnPct);
    }

    return returns;
  }

  /**
   * Calculate mean of an array
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((acc, val) => acc + val, 0);
    return sum / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStandardDeviation(
    values: number[],
    mean: number
  ): number {
    if (values.length === 0) return 0;

    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    const variance = this.calculateMean(squaredDiffs);
    return Math.sqrt(variance);
  }

  /**
   * Calculate Value at Risk (VaR)
   */
  private calculateVaR(returns: number[], confidenceLevel: number): number {
    const sortedReturns = [...returns].sort((a, b) => a - b);
    const index = Math.floor((1 - confidenceLevel) * sortedReturns.length);
    return Math.abs(sortedReturns[index] || 0);
  }

  /**
   * Calculate Maximum Drawdown
   */
  private calculateMaxDrawdown(priceHistory: PricePoint[]): number {
    let maxDrawdown = 0;
    let peak = priceHistory[0]?.price || 0;

    for (const point of priceHistory) {
      if (point.price > peak) {
        peak = point.price;
      }
      const drawdown = (peak - point.price) / peak;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    return maxDrawdown;
  }

  /**
   * Determine risk level based on volatility
   */
  private determineRiskLevel(
    volatility: number
  ): 'low' | 'medium' | 'high' {
    if (volatility < 0.2) return 'low';
    if (volatility < 0.5) return 'medium';
    return 'high';
  }
}
