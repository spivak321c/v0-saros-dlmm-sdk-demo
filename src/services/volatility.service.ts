import type { VolatilityData } from "../types"
import { CalculationUtils } from "../utils/calculations"
import { Logger } from "../utils/logger"

export class VolatilityService {
  private volatilityCache: Map<string, VolatilityData> = new Map()
  private readonly CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cached volatility or calculate new
   */
  async getVolatility(poolAddress: string, priceData: number[]): Promise<VolatilityData> {
    const cached = this.volatilityCache.get(poolAddress)

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      Logger.info("Using cached volatility", { poolAddress })
      return cached
    }

    const volatility = CalculationUtils.calculateVolatility(priceData)
    this.volatilityCache.set(poolAddress, volatility)

    Logger.info("Calculated new volatility", {
      poolAddress,
      stdDev: volatility.stdDev,
      mean: volatility.mean,
    })

    return volatility
  }

  /**
   * Determine if volatility is high
   */
  isHighVolatility(volatility: VolatilityData, threshold = 0.05): boolean {
    const volatilityRatio = volatility.stdDev / volatility.mean
    return volatilityRatio > threshold
  }

  /**
   * Get recommended range width based on volatility
   */
  getRecommendedRangeWidth(volatility: VolatilityData, baseWidth = 0.1): number {
    const volatilityRatio = volatility.stdDev / volatility.mean

    // Adjust range: higher volatility = wider range
    if (volatilityRatio > 0.1) {
      return baseWidth * 2.0 // Very high volatility
    } else if (volatilityRatio > 0.05) {
      return baseWidth * 1.5 // High volatility
    } else if (volatilityRatio > 0.02) {
      return baseWidth * 1.2 // Medium volatility
    } else {
      return baseWidth * 0.8 // Low volatility - tighter range
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.volatilityCache.clear()
    Logger.info("Volatility cache cleared")
  }
}
