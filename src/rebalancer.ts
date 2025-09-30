import type { Connection, Keypair } from "@solana/web3.js"
import { DLMMService } from "./services/dlmm.service"
import { VolatilityService } from "./services/volatility.service"
import { TelegramService } from "./services/telegram.service"
import { Logger } from "./utils/logger"
import { config, getConnection, validateConfig } from "./config"
import { getWallet } from "./utils/wallet"
import type { Position, RebalanceAction } from "./types"

/**
 * Automated Rebalancer - Monitors positions and rebalances when out of range
 * Uses volatility-adjusted ranges for optimal capital efficiency
 */
export class AutomatedRebalancer {
  private connection: Connection
  private wallet: Keypair
  private dlmmService: DLMMService
  private volatilityService: VolatilityService
  private telegramService: TelegramService
  private isRunning = false
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    this.connection = getConnection()
    this.wallet = getWallet()
    this.dlmmService = new DLMMService(this.connection, this.wallet)
    this.volatilityService = new VolatilityService()
    this.telegramService = new TelegramService()
  }

  /**
   * Start the automated rebalancer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      Logger.warn("Rebalancer is already running")
      return
    }

    Logger.info("Starting automated rebalancer...")
    this.isRunning = true

    // Send startup notification
    await this.telegramService.sendMessage("Automated rebalancer started. Monitoring positions...")

    // Run initial check
    await this.checkAndRebalance()

    // Schedule periodic checks
    this.checkInterval = setInterval(() => {
      this.checkAndRebalance().catch((error) => {
        Logger.error("Error in rebalance check", error)
      })
    }, config.rebalancer.checkInterval * 1000)

    Logger.success("Automated rebalancer started successfully")
  }

  /**
   * Stop the automated rebalancer
   */
  stop(): void {
    if (!this.isRunning) {
      Logger.warn("Rebalancer is not running")
      return
    }

    Logger.info("Stopping automated rebalancer...")
    this.isRunning = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    Logger.success("Automated rebalancer stopped")
  }

  /**
   * Check all positions and rebalance if necessary
   */
  private async checkAndRebalance(): Promise<void> {
    try {
      Logger.info("Checking positions for rebalancing...")

      // Get all user positions
      const positions = await this.dlmmService.getUserPositions(config.pools.monitored)

      if (positions.length === 0) {
        Logger.info("No positions to monitor")
        return
      }

      Logger.info(`Found ${positions.length} positions to monitor`)

      // Check each position
      for (const position of positions) {
        await this.checkPosition(position)
      }
    } catch (error) {
      Logger.error("Failed to check and rebalance positions", error)
    }
  }

  /**
   * Check a single position and rebalance if needed
   */
  private async checkPosition(position: Position): Promise<void> {
    try {
      const poolConfig = await this.dlmmService.getPoolConfig(position.poolAddress)
      if (!poolConfig) {
        Logger.error(`Failed to get pool config for ${position.poolAddress}`)
        return
      }

      const activeBin = await this.dlmmService.getActiveBin(position.poolAddress)

      // Check if position is out of range
      const outOfRangeThreshold = config.rebalancer.outOfRangeThreshold
      const rangeSize = position.upperBin - position.lowerBin
      const distanceFromLower = activeBin - position.lowerBin
      const distanceFromUpper = position.upperBin - activeBin

      const isOutOfRange =
        distanceFromLower < rangeSize * outOfRangeThreshold || distanceFromUpper < rangeSize * outOfRangeThreshold

      if (isOutOfRange) {
        Logger.warn(`Position ${position.positionId} is out of range`)
        await this.telegramService.sendOutOfRangeAlert(position)

        // Calculate new optimal range
        const binPrices = await this.dlmmService.getBinData(position.poolAddress)
        const volatility = await this.volatilityService.getVolatility(position.poolAddress, binPrices)
        const rangeWidth = this.volatilityService.getRecommendedRangeWidth(volatility)

        const currentPrice = this.dlmmService.calculateBinPrice(activeBin, poolConfig.binStep)
        const optimalRange = this.volatilityService.calculateOptimalBinRange(
          currentPrice,
          rangeWidth,
          poolConfig.binStep,
        )

        // Rebalance position
        const success = await this.dlmmService.rebalancePosition(position, optimalRange.lowerBin, optimalRange.upperBin)

        if (success) {
          const action: RebalanceAction = {
            positionId: position.positionId,
            poolAddress: position.poolAddress,
            action: "rebalance",
            reason: "Position out of optimal range",
            oldRange: {
              lower: position.lowerBin,
              upper: position.upperBin,
            },
            newRange: {
              lower: optimalRange.lowerBin,
              upper: optimalRange.upperBin,
            },
            timestamp: Date.now(),
          }

          await this.telegramService.sendRebalanceNotification(action)
        }
      } else {
        Logger.info(`Position ${position.positionId} is in range`)
      }

      // Check stop-loss
      if (config.rebalancer.stopLossEnabled) {
        const currentPrice = this.dlmmService.calculateBinPrice(activeBin, poolConfig.binStep)
        const lowerPrice = this.dlmmService.calculateBinPrice(position.lowerBin, poolConfig.binStep)

        const priceDropPercentage = ((lowerPrice - currentPrice) / lowerPrice) * 100

        if (priceDropPercentage > config.rebalancer.stopLossThreshold) {
          Logger.warn(`Stop-loss triggered for position ${position.positionId}`)
          await this.telegramService.sendStopLossAlert(position, currentPrice)

          const closed = await this.dlmmService.closePosition(position)
          if (closed) {
            Logger.success(`Position ${position.positionId} closed due to stop-loss`)
          }
        }
      }
    } catch (error) {
      Logger.error(`Failed to check position ${position.positionId}`, error)
    }
  }
}

// Main execution
async function main() {
  try {
    validateConfig()

    const rebalancer = new AutomatedRebalancer()
    await rebalancer.start()

    // Graceful shutdown
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

