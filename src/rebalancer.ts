import { getConnection, config, validateConfig } from "./config"
import { getWallet } from "./utils/wallet"
import { Logger } from "./utils/logger"
import { DLMMService } from "./services/dlmm.service"
import { VolatilityService } from "./services/volatility.service"
import { TelegramService } from "./services/telegram.service"
import { CalculationUtils } from "./utils/calculations"
import type { Position, RebalanceAction } from "./types"

class AutoRebalancer {
  private dlmmService: DLMMService
  private volatilityService: VolatilityService
  private telegramService: TelegramService
  private isRunning = false
  private rebalanceHistory: RebalanceAction[] = []

  constructor() {
    const connection = getConnection()
    const wallet = getWallet()

    this.dlmmService = new DLMMService(connection, wallet)
    this.volatilityService = new VolatilityService()
    this.telegramService = new TelegramService()
  }

  /**
   * Start the rebalancer
   */
  async start(): Promise<void> {
    Logger.info("Starting Auto Rebalancer", {
      interval: `${config.rebalancer.intervalMinutes} minutes`,
      pools: config.pools.monitored.length,
    })

    this.isRunning = true

    // Initial run
    await this.runRebalanceCheck()

    // Schedule periodic checks
    setInterval(
      async () => {
        if (this.isRunning) {
          await this.runRebalanceCheck()
        }
      },
      config.rebalancer.intervalMinutes * 60 * 1000,
    )
  }

  /**
   * Stop the rebalancer
   */
  stop(): void {
    Logger.info("Stopping Auto Rebalancer")
    this.isRunning = false
  }

  /**
   * Run rebalance check for all positions
   */
  private async runRebalanceCheck(): Promise<void> {
    Logger.info("Running rebalance check...")

    try {
      // Get all user positions
      const positions = await this.dlmmService.getUserPositions(config.pools.monitored)

      if (positions.length === 0) {
        Logger.warn("No positions found")
        return
      }

      Logger.info(`Checking ${positions.length} positions`)

      // Check each position
      for (const position of positions) {
        await this.checkPosition(position)
      }

      Logger.success("Rebalance check completed")
    } catch (error) {
      Logger.error("Error during rebalance check", error)
    }
  }

  /**
   * Check individual position and rebalance if needed
   */
  private async checkPosition(position: Position): Promise<void> {
    Logger.info(`Checking position ${position.positionId}`)

    try {
      // Get current active bin
      const activeBin = await this.dlmmService.getActiveBin(position.poolAddress)

      // Check if out of range
      const isOutOfRange = CalculationUtils.isPositionOutOfRange(
        activeBin,
        position.lowerBin,
        position.upperBin,
        config.rebalancer.outOfRangeThreshold,
      )

      if (!isOutOfRange) {
        Logger.info(`Position ${position.positionId} is in range`)
        return
      }

      // Position is out of range - send alert
      Logger.warn(`Position ${position.positionId} is out of range`)
      await this.telegramService.sendOutOfRangeAlert(position)

      // Check for stop-loss
      if (config.stopLoss.enabled) {
        const stopLossTriggered = await this.checkStopLoss(position, activeBin)
        if (stopLossTriggered) {
          return
        }
      }

      // Calculate volatility
      const binPrices = await this.dlmmService.getBinData(position.poolAddress)
      const volatility = await this.volatilityService.getVolatility(position.poolAddress, binPrices)

      // Calculate optimal new range
      const poolConfig = await this.dlmmService.getPoolConfig(position.poolAddress)
      if (!poolConfig) {
        Logger.error("Failed to get pool config")
        return
      }

      const currentPrice = CalculationUtils.binIdToPrice(activeBin, poolConfig.binStep)
      const rangeWidth = this.volatilityService.getRecommendedRangeWidth(volatility)
      const optimalRange = CalculationUtils.calculateOptimalRange(currentPrice, volatility, rangeWidth)

      // Convert prices to bin IDs
      const newLowerBin = CalculationUtils.priceToBinId(optimalRange.lower, poolConfig.binStep)
      const newUpperBin = CalculationUtils.priceToBinId(optimalRange.upper, poolConfig.binStep)

      // Execute rebalance
      Logger.info(`Rebalancing position ${position.positionId}`, {
        oldRange: { lower: position.lowerBin, upper: position.upperBin },
        newRange: { lower: newLowerBin, upper: newUpperBin },
        volatility: volatility.stdDev / volatility.mean,
      })

      const success = await this.dlmmService.rebalancePosition(position, newLowerBin, newUpperBin)

      if (success) {
        const action: RebalanceAction = {
          positionId: position.positionId,
          poolAddress: position.poolAddress,
          action: "rebalance",
          reason: "Position out of range - volatility-adjusted rebalance",
          oldRange: { lower: position.lowerBin, upper: position.upperBin },
          newRange: { lower: newLowerBin, upper: newUpperBin },
          timestamp: Date.now(),
        }

        this.rebalanceHistory.push(action)
        await this.telegramService.sendRebalanceNotification(action)

        Logger.success(`Position ${position.positionId} rebalanced successfully`)
      } else {
        Logger.error(`Failed to rebalance position ${position.positionId}`)
      }
    } catch (error) {
      Logger.error(`Error checking position ${position.positionId}`, error)
    }
  }

  /**
   * Check if stop-loss should be triggered
   */
  private async checkStopLoss(position: Position, activeBin: number): Promise<boolean> {
    const poolConfig = await this.dlmmService.getPoolConfig(position.poolAddress)
    if (!poolConfig) return false

    const currentPrice = CalculationUtils.binIdToPrice(activeBin, poolConfig.binStep)
    const positionMidPrice = CalculationUtils.binIdToPrice(
      (position.lowerBin + position.upperBin) / 2,
      poolConfig.binStep,
    )

    const priceChange = Math.abs(currentPrice - positionMidPrice) / positionMidPrice

    if (priceChange > config.stopLoss.percentage) {
      Logger.warn(`Stop-loss triggered for position ${position.positionId}`)

      const success = await this.dlmmService.executeStopLoss(position)

      if (success) {
        await this.telegramService.sendStopLossAlert(position, currentPrice)

        const action: RebalanceAction = {
          positionId: position.positionId,
          poolAddress: position.poolAddress,
          action: "stop-loss",
          reason: `Price moved ${(priceChange * 100).toFixed(2)}% - stop-loss triggered`,
          oldRange: { lower: position.lowerBin, upper: position.upperBin },
          timestamp: Date.now(),
        }

        this.rebalanceHistory.push(action)
        return true
      }
    }

    return false
  }

  /**
   * Get rebalance history
   */
  getHistory(): RebalanceAction[] {
    return this.rebalanceHistory
  }
}

// Main execution
async function main() {
  try {
    validateConfig()

    const rebalancer = new AutoRebalancer()
    await rebalancer.start()

    // Handle graceful shutdown
    process.on("SIGINT", () => {
      Logger.info("Received SIGINT, shutting down...")
      rebalancer.stop()
      process.exit(0)
    })

    process.on("SIGTERM", () => {
      Logger.info("Received SIGTERM, shutting down...")
      rebalancer.stop()
      process.exit(0)
    })
  } catch (error) {
    Logger.error("Fatal error in rebalancer", error)
    process.exit(1)
  }
}

// Run if executed directly
if (require.main === module) {
  main()
}

export { AutoRebalancer }
