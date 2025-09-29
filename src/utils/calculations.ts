import BN from "bn.js"
import type { VolatilityData } from "../types"

export class CalculationUtils {
  /**
   * Calculate volatility from price data
   */
  static calculateVolatility(prices: number[]): VolatilityData {
    if (prices.length < 2) {
      return {
        stdDev: 0,
        mean: prices[0] || 0,
        recentPrices: prices,
        timestamp: Date.now(),
      }
    }

    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length
    const stdDev = Math.sqrt(variance)

    return {
      stdDev,
      mean,
      recentPrices: prices,
      timestamp: Date.now(),
    }
  }

  /**
   * Calculate optimal range width based on volatility
   */
  static calculateOptimalRange(
    currentPrice: number,
    volatility: VolatilityData,
    baseRangePercent = 0.1,
  ): { lower: number; upper: number } {
    // Adjust range based on volatility
    // Higher volatility = wider range to reduce rebalancing frequency
    const volatilityRatio = volatility.stdDev / volatility.mean
    const rangeMultiplier = 1 + volatilityRatio * 2

    const rangeWidth = currentPrice * baseRangePercent * rangeMultiplier

    return {
      lower: currentPrice - rangeWidth,
      upper: currentPrice + rangeWidth,
    }
  }

  /**
   * Convert price to bin ID
   */
  static priceToBinId(price: number, binStep: number): number {
    // binStep is in basis points (e.g., 1 = 0.01%)
    const stepDecimal = binStep / 10000
    return Math.floor(Math.log(price) / Math.log(1 + stepDecimal))
  }

  /**
   * Convert bin ID to price
   */
  static binIdToPrice(binId: number, binStep: number): number {
    const stepDecimal = binStep / 10000
    return Math.pow(1 + stepDecimal, binId)
  }

  /**
   * Check if position is out of range
   */
  static isPositionOutOfRange(currentBinId: number, lowerBinId: number, upperBinId: number, threshold = 0.1): boolean {
    const rangeSize = upperBinId - lowerBinId
    const distanceFromLower = currentBinId - lowerBinId
    const distanceFromUpper = upperBinId - currentBinId

    // Out of range if current price is outside bounds
    if (currentBinId < lowerBinId || currentBinId > upperBinId) {
      return true
    }

    // Near edge if within threshold of bounds
    const nearLowerEdge = distanceFromLower < rangeSize * threshold
    const nearUpperEdge = distanceFromUpper < rangeSize * threshold

    return nearLowerEdge || nearUpperEdge
  }

  /**
   * Calculate impermanent loss
   */
  static calculateImpermanentLoss(initialPrice: number, currentPrice: number): number {
    const priceRatio = currentPrice / initialPrice
    const il = (2 * Math.sqrt(priceRatio)) / (1 + priceRatio) - 1
    return Math.abs(il) * 100 // Return as percentage
  }

  /**
   * Calculate APY from fees
   */
  static calculateAPY(feesEarned: number, liquidityValue: number, daysElapsed: number): number {
    if (liquidityValue === 0 || daysElapsed === 0) return 0
    const dailyReturn = feesEarned / liquidityValue / daysElapsed
    return dailyReturn * 365 * 100 // Annualized percentage
  }

  /**
   * Convert BN to number with decimals
   */
  static bnToNumber(bn: BN, decimals: number): number {
    const divisor = new BN(10).pow(new BN(decimals))
    return bn.div(divisor).toNumber() + bn.mod(divisor).toNumber() / divisor.toNumber()
  }

  /**
   * Convert number to BN with decimals
   */
  static numberToBN(num: number, decimals: number): BN {
    const multiplier = new BN(10).pow(new BN(decimals))
    return new BN(Math.floor(num * Math.pow(10, decimals))).mul(multiplier.div(new BN(Math.pow(10, decimals))))
  }
}
