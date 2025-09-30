import { Logger } from "../utils/logger";

export interface VolatilityMetrics {
  mean: number;
  stdDev: number;
  volatilityRatio: number;
  historicalPrices: Array<{ timestamp: number; price: number }>;
}

/**
 * Volatility Service - Calculates market volatility for optimal range sizing
 * Uses bin price data to determine position range width
 */
export class VolatilityService {
  private readonly HIGH_VOLATILITY_THRESHOLD = 0.05; // 5%
  private readonly LOW_VOLATILITY_THRESHOLD = 0.02; // 2%

  /**
   * Calculate volatility metrics from bin price data
   * @param poolAddress - Pool address
   * @param binPrices - Array of historical bin prices
   */
  async getVolatility(
    poolAddress: string,
    binPrices: number[]
  ): Promise<VolatilityMetrics> {
    try {
      if (binPrices.length < 2) {
        throw new Error("Insufficient price data for volatility calculation");
      }

      // Calculate mean price
      const mean =
        binPrices.reduce((sum, price) => sum + price, 0) / binPrices.length;

      // Calculate standard deviation
      const squaredDiffs = binPrices.map((price) => Math.pow(price - mean, 2));
      const variance =
        squaredDiffs.reduce((sum, diff) => sum + diff, 0) / binPrices.length;
      const stdDev = Math.sqrt(variance);

      // Calculate volatility ratio (coefficient of variation)
      const volatilityRatio = stdDev / mean;

      // Format historical prices for charting
      const historicalPrices = binPrices.map((price, index) => ({
        timestamp: Date.now() - (binPrices.length - index) * 60000, // 1 minute intervals
        price,
      }));

      Logger.info(`Volatility calculated for ${poolAddress}`, {
        mean: mean.toFixed(2),
        stdDev: stdDev.toFixed(2),
        volatilityRatio: (volatilityRatio * 100).toFixed(2) + "%",
      });

      return {
        mean,
        stdDev,
        volatilityRatio,
        historicalPrices,
      };
    } catch (error) {
      Logger.error("Failed to calculate volatility", error);
      throw error;
    }
  }

  /**
   * Determine if volatility is high
   * @param metrics - Volatility metrics
   */
  isHighVolatility(metrics: VolatilityMetrics): boolean {
    return metrics.volatilityRatio > this.HIGH_VOLATILITY_THRESHOLD;
  }

  /**
   * Determine if volatility is low
   * @param metrics - Volatility metrics
   */
  isLowVolatility(metrics: VolatilityMetrics): boolean {
    return metrics.volatilityRatio < this.LOW_VOLATILITY_THRESHOLD;
  }

  /**
   * Get recommended range width based on volatility
   * Higher volatility = wider range to reduce rebalancing frequency
   * Lower volatility = tighter range for better capital efficiency
   * @param metrics - Volatility metrics
   */
  getRecommendedRangeWidth(metrics: VolatilityMetrics): number {
    const { volatilityRatio } = metrics;

    // Base range width: 10%
    const baseWidth = 0.1;

    // Adjust based on volatility
    // High volatility: increase range width up to 30%
    // Low volatility: decrease range width down to 5%
    if (volatilityRatio > this.HIGH_VOLATILITY_THRESHOLD) {
      // High volatility: wider range
      const multiplier =
        1 + (volatilityRatio - this.HIGH_VOLATILITY_THRESHOLD) * 10;
      return Math.min(baseWidth * multiplier, 0.3); // Cap at 30%
    } else if (volatilityRatio < this.LOW_VOLATILITY_THRESHOLD) {
      // Low volatility: tighter range
      const multiplier = volatilityRatio / this.LOW_VOLATILITY_THRESHOLD;
      return Math.max(baseWidth * multiplier, 0.05); // Floor at 5%
    }

    // Medium volatility: use base width
    return baseWidth;
  }

  /**
   * Calculate optimal bin range around current price
   * @param currentPrice - Current market price
   * @param rangeWidth - Range width as percentage (e.g., 0.1 for 10%)
   * @param binStep - Bin step in basis points
   */
  calculateOptimalBinRange(
    currentPrice: number,
    rangeWidth: number,
    binStep: number
  ): {
    lowerBin: number;
    upperBin: number;
    lowerPrice: number;
    upperPrice: number;
  } {
    // Calculate price bounds
    const lowerPrice = currentPrice * (1 - rangeWidth / 2);
    const upperPrice = currentPrice * (1 + rangeWidth / 2);

    // Convert to bin IDs
    const lowerBin = this.priceToBinId(lowerPrice, binStep);
    const upperBin = this.priceToBinId(upperPrice, binStep);

    return {
      lowerBin,
      upperBin,
      lowerPrice,
      upperPrice,
    };
  }

  /**
   * Convert price to bin ID
   * Formula: binId = log(price) / log(1 + binStep / 10000)
   */
  private priceToBinId(price: number, binStep: number): number {
    return Math.floor(Math.log(price) / Math.log(1 + binStep / 10000));
  }

  /**
   * Convert bin ID to price
   * Formula: price = (1 + binStep / 10000) ^ binId
   */
  private binIdToPrice(binId: number, binStep: number): number {
    return Math.pow(1 + binStep / 10000, binId);
  }
}
