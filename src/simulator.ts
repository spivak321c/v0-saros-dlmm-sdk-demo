import { Logger } from "./utils/logger"
import { CalculationUtils } from "./utils/calculations"
import type { SimulationResult } from "./types"

interface SimulationConfig {
  initialPrice: number
  priceData: number[]
  initialLiquidity: number
  feeTier: number
  binStep: number
  gasPerRebalance: number
}

class StrategySimulator {
  /**
   * Simulate no rebalancing strategy
   */
  private simulateNoRebalancing(config: SimulationConfig): SimulationResult {
    Logger.info("Simulating: No Rebalancing")

    const { priceData, initialPrice, initialLiquidity, feeTier } = config

    // Calculate fees assuming position stays in range
    const avgVolume = 10000 // Mock daily volume
    const daysInRange = priceData.filter((p) => Math.abs(p - initialPrice) / initialPrice < 0.1).length / 24
    const totalFees = (avgVolume * (feeTier / 10000) * daysInRange) / 10

    // Calculate IL
    const finalPrice = priceData[priceData.length - 1]
    const il = CalculationUtils.calculateImpermanentLoss(initialPrice, finalPrice)

    return {
      strategy: "No Rebalancing",
      totalFees,
      impermanentLoss: (il / 100) * initialLiquidity,
      netReturn: totalFees - (il / 100) * initialLiquidity,
      rebalanceCount: 0,
      gasSpent: 0,
    }
  }

  /**
   * Simulate fixed range rebalancing
   */
  private simulateFixedRange(config: SimulationConfig, rangePercent: number): SimulationResult {
    Logger.info(`Simulating: Fixed Range (${rangePercent * 100}%)`)

    const { priceData, initialPrice, initialLiquidity, feeTier, gasPerRebalance } = config

    let rebalanceCount = 0
    let totalFees = 0
    let currentRange = {
      lower: initialPrice * (1 - rangePercent),
      upper: initialPrice * (1 + rangePercent),
    }

    // Simulate day by day
    for (let i = 0; i < priceData.length; i += 24) {
      const currentPrice = priceData[i]

      // Check if out of range
      if (currentPrice < currentRange.lower || currentPrice > currentRange.upper) {
        rebalanceCount++
        currentRange = {
          lower: currentPrice * (1 - rangePercent),
          upper: currentPrice * (1 + rangePercent),
        }
      }

      // Calculate fees for the day (higher fees when in range)
      const isInRange = currentPrice >= currentRange.lower && currentPrice <= currentRange.upper
      if (isInRange) {
        totalFees += (10000 * (feeTier / 10000)) / 10
      }
    }

    const finalPrice = priceData[priceData.length - 1]
    const il = CalculationUtils.calculateImpermanentLoss(initialPrice, finalPrice)
    const gasSpent = rebalanceCount * gasPerRebalance

    return {
      strategy: `Fixed Range (${rangePercent * 100}%)`,
      totalFees,
      impermanentLoss: (il / 100) * initialLiquidity,
      netReturn: totalFees - (il / 100) * initialLiquidity - gasSpent,
      rebalanceCount,
      gasSpent,
    }
  }

  /**
   * Simulate volatility-adjusted rebalancing
   */
  private simulateVolatilityAdjusted(config: SimulationConfig): SimulationResult {
    Logger.info("Simulating: Volatility-Adjusted Rebalancing")

    const { priceData, initialPrice, initialLiquidity, feeTier, gasPerRebalance } = config

    let rebalanceCount = 0
    let totalFees = 0
    let currentRange = {
      lower: initialPrice * 0.9,
      upper: initialPrice * 1.1,
    }

    // Simulate with volatility windows
    const windowSize = 50
    for (let i = 0; i < priceData.length; i += 24) {
      const currentPrice = priceData[i]

      // Calculate volatility from recent data
      const recentPrices = priceData.slice(Math.max(0, i - windowSize), i + 1)
      const volatility = CalculationUtils.calculateVolatility(recentPrices)
      const volatilityRatio = volatility.stdDev / volatility.mean

      // Adjust range based on volatility
      let rangePercent = 0.1
      if (volatilityRatio > 0.1) {
        rangePercent = 0.2 // High volatility - wider range
      } else if (volatilityRatio > 0.05) {
        rangePercent = 0.15 // Medium volatility
      } else if (volatilityRatio < 0.02) {
        rangePercent = 0.08 // Low volatility - tighter range
      }

      // Check if out of range
      if (currentPrice < currentRange.lower || currentPrice > currentRange.upper) {
        rebalanceCount++
        currentRange = {
          lower: currentPrice * (1 - rangePercent),
          upper: currentPrice * (1 + rangePercent),
        }
      }

      // Calculate fees (better fees with tighter ranges in low volatility)
      const isInRange = currentPrice >= currentRange.lower && currentPrice <= currentRange.upper
      if (isInRange) {
        const feeMultiplier = 1 + (0.1 - rangePercent) * 2 // Tighter range = more fees
        totalFees += ((10000 * (feeTier / 10000)) / 10) * feeMultiplier
      }
    }

    const finalPrice = priceData[priceData.length - 1]
    const il = CalculationUtils.calculateImpermanentLoss(initialPrice, finalPrice)
    const gasSpent = rebalanceCount * gasPerRebalance

    return {
      strategy: "Volatility-Adjusted (Recommended)",
      totalFees,
      impermanentLoss: (il / 100) * initialLiquidity,
      netReturn: totalFees - (il / 100) * initialLiquidity - gasSpent,
      rebalanceCount,
      gasSpent,
    }
  }

  /**
   * Generate mock historical price data
   */
  private generateMockPriceData(days: number, basePrice: number, volatility: number): number[] {
    const prices: number[] = []
    let currentPrice = basePrice

    for (let i = 0; i < days * 24; i++) {
      // Hourly data
      const change = (Math.random() - 0.5) * volatility * currentPrice
      currentPrice = Math.max(currentPrice + change, basePrice * 0.5) // Prevent negative prices
      prices.push(currentPrice)
    }

    return prices
  }

  /**
   * Run full simulation
   */
  async runSimulation(): Promise<void> {
    Logger.info("Starting Strategy Simulation")
    Logger.info("=".repeat(60))

    // Generate mock data
    const basePrice = 100
    const priceData = this.generateMockPriceData(30, basePrice, 0.02) // 30 days, 2% volatility

    const config: SimulationConfig = {
      initialPrice: basePrice,
      priceData,
      initialLiquidity: 10000,
      feeTier: 30, // 0.3%
      binStep: 1,
      gasPerRebalance: 5, // $5 per rebalance
    }

    // Run simulations
    const results: SimulationResult[] = []

    results.push(this.simulateNoRebalancing(config))
    results.push(this.simulateFixedRange(config, 0.05))
    results.push(this.simulateFixedRange(config, 0.1))
    results.push(this.simulateFixedRange(config, 0.15))
    results.push(this.simulateVolatilityAdjusted(config))

    // Display results
    Logger.info("\n" + "=".repeat(60))
    Logger.info("SIMULATION RESULTS (30-day period)")
    Logger.info("=".repeat(60))

    // Sort by net return
    results.sort((a, b) => b.netReturn - a.netReturn)

    for (const result of results) {
      Logger.info(`\n${result.strategy}`)
      Logger.info("-".repeat(60))
      Logger.info(`Total Fees Earned:     $${result.totalFees.toFixed(2)}`)
      Logger.info(`Impermanent Loss:      $${result.impermanentLoss.toFixed(2)}`)
      Logger.info(`Gas Spent:             $${result.gasSpent.toFixed(2)}`)
      Logger.info(`Rebalance Count:       ${result.rebalanceCount}`)
      Logger.info(`Net Return:            $${result.netReturn.toFixed(2)}`)
      Logger.info(`ROI:                   ${((result.netReturn / config.initialLiquidity) * 100).toFixed(2)}%`)
    }

    Logger.info("\n" + "=".repeat(60))
    Logger.success(`Best Strategy: ${results[0].strategy}`)
    Logger.info(
      `Net Return: $${results[0].netReturn.toFixed(2)} (${((results[0].netReturn / config.initialLiquidity) * 100).toFixed(2)}% ROI)`,
    )
    Logger.info("=".repeat(60))

    // Analysis
    Logger.info("\nKEY INSIGHTS:")
    Logger.info("1. Volatility-adjusted rebalancing optimizes range width based on market conditions")
    Logger.info("2. Tighter ranges in low volatility = higher capital efficiency and fees")
    Logger.info("3. Wider ranges in high volatility = fewer rebalances and lower gas costs")
    Logger.info("4. Optimal strategy balances fee generation with rebalancing costs")
  }
}

// Main execution
async function main() {
  try {
    const simulator = new StrategySimulator()
    await simulator.runSimulation()
  } catch (error) {
    Logger.error("Simulation failed", error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

export { StrategySimulator }
