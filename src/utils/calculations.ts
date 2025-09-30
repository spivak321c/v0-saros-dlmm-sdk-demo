import type BN from "bn.js"

/**
 * Calculation utilities for DLMM operations
 */
export class CalculationUtils {
  /**
   * Convert BigNumber to regular number with decimals
   */
  static bnToNumber(bn: bigint | BN, decimals: number): number {
    const bnValue = typeof bn === "bigint" ? bn : BigInt(bn.toString())
    return Number(bnValue) / Math.pow(10, decimals)
  }

  /**
   * Convert number to BigNumber with decimals
   */
  static numberToBn(num: number, decimals: number): bigint {
    return BigInt(Math.floor(num * Math.pow(10, decimals)))
  }

  /**
   * Calculate bin price from bin ID
   * Formula: price = (1 + binStep / 10000) ^ binId
   */
  static binIdToPrice(binId: number, binStep: number): number {
    return Math.pow(1 + binStep / 10000, binId)
  }

  /**
   * Calculate bin ID from price
   * Formula: binId = log(price) / log(1 + binStep / 10000)
   */
  static priceToBinId(price: number, binStep: number): number {
    return Math.floor(Math.log(price) / Math.log(1 + binStep / 10000))
  }

  /**
   * Check if position is out of range
   */
  static isPositionOutOfRange(activeBin: number, lowerBin: number, upperBin: number, threshold = 0.2): boolean {
    const rangeSize = upperBin - lowerBin
    const distanceFromLower = activeBin - lowerBin
    const distanceFromUpper = upperBin - activeBin

    return distanceFromLower < rangeSize * threshold || distanceFromUpper < rangeSize * threshold
  }

  /**
   * Calculate optimal range around current price
   */
  static calculateOptimalRange(
    currentPrice: number,
    volatility: { mean: number; stdDev: number; volatilityRatio: number },
    rangeWidth: number,
  ): { lower: number; upper: number } {
    const halfWidth = rangeWidth / 2
    return {
      lower: currentPrice * (1 - halfWidth),
      upper: currentPrice * (1 + halfWidth),
    }
  }

  /**
   * Calculate impermanent loss
   */
  static calculateImpermanentLoss(priceRatio: number): number {
    const sqrtRatio = Math.sqrt(priceRatio)
    const il = (2 * sqrtRatio) / (1 + priceRatio) - 1
    return Math.abs(il) * 100
  }

  /**
   * Calculate APY from fees
   */
  static calculateAPY(feesEarned: number, principal: number, daysElapsed: number): number {
    if (principal === 0 || daysElapsed === 0) return 0
    const dailyReturn = feesEarned / principal / daysElapsed
    return dailyReturn * 365 * 100
  }
}
