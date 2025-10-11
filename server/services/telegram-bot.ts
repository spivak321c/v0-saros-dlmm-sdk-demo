import { Telegraf } from "telegraf";
import { Agent } from "https";
import BN from "bn.js";
import type { RebalanceEvent, Alert } from "../../shared/schema";
import storage from "../storage";
import { config } from "../config";
import { positionMonitor } from "./position-monitor";
import { volatilityTracker } from "./volatility-tracker";
import { dlmmClient } from "../solana/dlmm-client";
import { logger } from "../utils/logger";
import { simulatorService } from "./simulator.service";

interface TelegramConfig {
  botToken?: string;
  chatId?: string;
  enabled: boolean;
}

export class TelegramBot {
  private config: TelegramConfig;
  private bot?: Telegraf;
  private monitoringInterval?: NodeJS.Timeout;
  private monitoringWallet?: string;

  constructor() {
    // Load from environment or storage
    const envToken = config.telegram.botToken;
    const envChatId = config.telegram.chatId;
    const storedSettings = storage.getTelegramSettings();

    this.config = {
      botToken: envToken || storedSettings.botToken,
      chatId: envChatId || storedSettings.chatId,
      enabled:
        storedSettings.enabled && !!(envToken || storedSettings.botToken),
    };

    if (this.config.enabled && this.config.botToken) {
      this.initializeBot();
      logger.info("Telegram bot initialized from environment/storage");
    }
  }

  private initializeBot() {
    if (!this.config.botToken) return;

    const agent = new Agent({ family: 4 });
    this.bot = new Telegraf(this.config.botToken, {
      telegram: { agent },
    });

    this.setupCommands();
  }

  private setupCommands() {
    if (!this.bot) return;

    this.bot.command("start", (ctx) => {
      ctx.reply(
        "🚀 *Welcome to Saros DLMM Rebalancer!*\n\n" +
          "Available commands:\n" +
          "/monitor <wallet> - Start monitoring positions\n" +
          "/positions <wallet> - View all active positions\n" +
          "/rebalance <wallet> - Check rebalancing opportunities\n" +
          "/simulate - Run strategy simulator\n" +
          "/volatility <pool> - Check pool volatility\n" +
          "/stop - Stop monitoring",
        { parse_mode: "Markdown" }
      );
    });

    this.bot.command("monitor", async (ctx) => {
      const args = ctx.message.text.split(" ");
      const walletAddress = args[1];

      if (!walletAddress) {
        ctx.reply("Usage: /monitor <wallet_address>");
        return;
      }

      if (this.monitoringInterval) {
        ctx.reply("⚠️ Monitoring is already active! Use /stop first.");
        return;
      }

      ctx.reply(
        `✅ Starting position monitoring for ${walletAddress.slice(0, 8)}...${walletAddress.slice(-8)}`
      );
      this.startMonitoring(ctx.chat.id, walletAddress);
    });

    this.bot.command("stop", (ctx) => {
      if (this.monitoringInterval) {
        clearInterval(this.monitoringInterval);
        this.monitoringInterval = undefined;
        this.monitoringWallet = undefined;
        ctx.reply("🛑 Monitoring stopped.");
      } else {
        ctx.reply("ℹ️ No active monitoring to stop.");
      }
    });

    this.bot.command("positions", async (ctx) => {
      const args = ctx.message.text.split(" ");
      const walletAddress = args[1];

      if (!walletAddress) {
        ctx.reply("Usage: /positions <wallet_address>");
        return;
      }

      ctx.reply("🔍 Fetching positions...");

      // Execute async without blocking bot
      this.fetchPositionsAsync(ctx.chat.id, walletAddress).catch((error) => {
        logger.error("Error in async positions fetch", { error });
      });
    });

    this.bot.command("rebalance", async (ctx) => {
      const args = ctx.message.text.split(" ");
      const walletAddress = args[1];

      if (!walletAddress) {
        ctx.reply("Usage: /rebalance <wallet_address>");
        return;
      }

      ctx.reply("🔍 Checking positions for rebalancing opportunities...");

      // Execute async without blocking bot
      this.checkRebalanceAsync(ctx.chat.id, walletAddress).catch((error) => {
        logger.error("Error in async rebalance check", { error });
      });
    });

    this.bot.command("volatility", async (ctx) => {
      try {
        const args = ctx.message.text.split(" ");
        const poolAddress = args[1];

        if (!poolAddress) {
          ctx.reply("Usage: /volatility <pool_address>");
          return;
        }

        ctx.reply("📊 Calculating volatility...");
        const volatilityData =
          await volatilityTracker.getVolatilityData(poolAddress);

        if (!volatilityData) {
          ctx.reply("❌ No volatility data available for this pool");
          return;
        }

        ctx.reply(
          `📈 *Pool Volatility*\n\n` +
            `Pool: \`${poolAddress.slice(0, 8)}...${poolAddress.slice(-8)}\`\n` +
            `Volatility: ${volatilityData.volatility.toFixed(2)}%\n` +
            `24h Change: ${volatilityData.priceChange24h.toFixed(2)}%`,
          { parse_mode: "Markdown" }
        );
      } catch (error) {
        logger.error("Error fetching volatility via Telegram", { error });
        ctx.reply(
          `❌ Error fetching volatility: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    this.bot.command("simulate", async (ctx) => {
      ctx.reply("🔄 Running strategy simulation...");

      // Execute async without blocking bot
      this.runSimulationAsync(ctx.chat.id).catch((error) => {
        logger.error("Error in async simulation", { error });
      });
    });
  }

  private async fetchPositionsAsync(chatId: number, walletAddress: string) {
    try {
      // Fetch positions from both blockchain and storage
      const blockchainPositions = await Promise.race([
        positionMonitor.loadUserPositions(walletAddress),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), 60000)
        ),
      ]);

      // Also get positions from storage
      const storedPositions = storage.getUserPositions(walletAddress);

      // Merge positions, avoiding duplicates
      const positionMap = new Map();
      blockchainPositions.forEach((p) =>
        positionMap.set(p.position.address, p)
      );
      storedPositions.forEach((p) => {
        if (!positionMap.has(p.position.address)) {
          positionMap.set(p.position.address, p);
        }
      });

      const positions = Array.from(positionMap.values());

      if (positions.length === 0) {
        await this.bot?.telegram.sendMessage(
          chatId,
          "No active positions found."
        );
        return;
      }

      let message = `📊 *Your Active Positions (${positions.length})*\n\n`;

      for (const pos of positions) {
        const poolPair = `${pos.pool.tokenX.symbol}/${pos.pool.tokenY.symbol}`;
        message += `*${poolPair}*\n`;
        message += `   💰 Value: $${pos.currentValue.toFixed(2)}\n`;
        message += `   📈 Fees: $${pos.feesEarned.total.toFixed(2)}\n`;
        message += `   📊 Range: [${pos.position.lowerBinId}, ${pos.position.upperBinId}]\n`;
        message += `   ${pos.riskMetrics.isInRange ? "✅ In Range" : "⚠️ Out of Range"}\n\n`;
      }

      await this.bot?.telegram.sendMessage(chatId, message, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error fetching positions via Telegram", { error });
      await this.bot?.telegram.sendMessage(
        chatId,
        `❌ Error fetching positions: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async checkRebalanceAsync(chatId: number, walletAddress: string) {
    try {
      const positions = await Promise.race([
        positionMonitor.loadUserPositions(walletAddress),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Request timeout")), 60000)
        ),
      ]);

      const toRebalance = positions.filter(
        (p) => !p.riskMetrics.isInRange || p.performance.impermanentLoss < -10
      );

      if (toRebalance.length === 0) {
        await this.bot?.telegram.sendMessage(
          chatId,
          "✅ All positions are optimal. No rebalancing needed."
        );
        return;
      }

      let message = `⚠️ *Found ${toRebalance.length} position(s) to rebalance:*\n\n`;

      for (const pos of toRebalance) {
        const poolPair = `${pos.pool.tokenX.symbol}/${pos.pool.tokenY.symbol}`;
        message += `*${poolPair}*\n`;
        message += `   ${!pos.riskMetrics.isInRange ? "⚠️ Out of range" : "📉 High IL"}\n`;
        message += `   Current: [${pos.position.lowerBinId}, ${pos.position.upperBinId}]\n\n`;
      }

      await this.bot?.telegram.sendMessage(chatId, message, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error checking rebalance via Telegram", { error });
      await this.bot?.telegram.sendMessage(
        chatId,
        `❌ Error during rebalancing check: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async runSimulationAsync(chatId: number) {
    try {
      const result = await simulatorService.runSimulation({
        initialLiquidity: new BN(10000),
        priceRange: { lower: 0.95, upper: 1.05 },
        duration: 30,
        rebalanceFrequency: 24,
        volatilityTarget: 0.15,
        feeRate: 30,
      });

      if (!result.success || !result.data) {
        throw new Error("Simulation failed");
      }

      const sim = result.data;
      const totalReturn = sim.totalReturn * 100;
      const feesEarned = sim.feesEarned;
      const maxDD = sim.maxDrawdown * 100;
      const sharpe = sim.sharpeRatio;

      const message =
        "📊 *Strategy Simulator Results (30 days)*\n\n" +
        `💰 Total Return: ${totalReturn >= 0 ? "+" : ""}${totalReturn.toFixed(2)}%\n` +
        `📈 Fees Earned: $${feesEarned.toFixed(2)}\n` +
        `📉 Max Drawdown: ${maxDD.toFixed(2)}%\n` +
        `📊 Sharpe Ratio: ${sharpe.toFixed(2)}\n` +
        `🔄 Rebalances: ${sim.rebalanceCount}\n\n` +
        `✅ Simulation completed successfully!`;

      await this.bot?.telegram.sendMessage(chatId, message, {
        parse_mode: "Markdown",
      });
    } catch (error) {
      logger.error("Error running simulation via Telegram", { error });
      await this.bot?.telegram.sendMessage(
        chatId,
        `❌ Error running simulation: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async startMonitoring(chatId: number, walletAddress: string) {
    this.monitoringWallet = walletAddress;

    this.monitoringInterval = setInterval(async () => {
      try {
        if (!this.monitoringWallet) return;

        const positions = await positionMonitor.loadUserPositions(
          this.monitoringWallet
        );

        for (const position of positions) {
          const poolPair = `${position.pool.tokenX.symbol}/${position.pool.tokenY.symbol}`;

          // Check if out of range
          if (!position.riskMetrics.isInRange) {
            await this.bot?.telegram.sendMessage(
              chatId,
              `⚠️ *Position Out of Range*\n\n` +
                `Pool: ${poolPair}\n` +
                `Position: \`${position.position.address.slice(0, 8)}...${position.position.address.slice(-8)}\`\n` +
                `Active Bin: ${position.pool.activeId}\n` +
                `Your Range: [${position.position.lowerBinId}, ${position.position.upperBinId}]`,
              { parse_mode: "Markdown" }
            );
          }

          // Check for high IL
          if (position.performance.impermanentLoss < -10) {
            await this.bot?.telegram.sendMessage(
              chatId,
              `📉 *High Impermanent Loss Alert*\n\n` +
                `Pool: ${poolPair}\n` +
                `Position: \`${position.position.address.slice(0, 8)}...${position.position.address.slice(-8)}\`\n` +
                `IL: ${position.performance.impermanentLoss.toFixed(2)}%`,
              { parse_mode: "Markdown" }
            );
          }
        }
      } catch (error) {
        logger.error("Monitoring error in Telegram bot", { error });
      }
    }, 60000); // Check every minute
  }

  configure(botToken: string, chatId: string) {
    this.config = {
      botToken,
      chatId,
      enabled: true,
    };
    storage.updateTelegramSettings({
      botToken,
      chatId,
      enabled: true,
    });

    // Reinitialize bot with new token
    if (this.bot) {
      this.bot.stop();
    }
    this.initializeBot();

    logger.info("Telegram bot configured and saved");
  }

  disable() {
    this.config.enabled = false;
    storage.updateTelegramSettings({ enabled: false });

    if (this.bot) {
      this.bot.stop();
    }
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info("Telegram bot disabled");
  }

  async sendRebalanceAlert(event: RebalanceEvent) {
    if (!this.config.enabled) return;

    const message = this.formatRebalanceMessage(event);
    await this.sendMessage(message);
  }

  async sendAlert(alert: Alert) {
    if (!this.config.enabled) return;

    const message = this.formatAlertMessage(alert);
    await this.sendMessage(message);
  }

  async sendPositionAlert(
    positionAddress: string,
    type: "out_of_range" | "high_il" | "stop_loss",
    details: string
  ) {
    if (!this.config.enabled) return;

    const emoji = {
      out_of_range: "⚠️",
      high_il: "📉",
      stop_loss: "🛑",
    }[type];

    const title = {
      out_of_range: "Position Out of Range",
      high_il: "High Impermanent Loss",
      stop_loss: "Stop-Loss Triggered",
    }[type];

    const message = `${emoji} *${title}*\n\nPosition: \`${positionAddress.slice(0, 8)}...${positionAddress.slice(-8)}\`\n\n${details}`;

    await this.sendMessage(message);
  }

  private formatRebalanceMessage(event: RebalanceEvent): string {
    const status =
      event.status === "success"
        ? "✅"
        : event.status === "failed"
          ? "❌"
          : "⏳";

    return (
      `${status} *Rebalance ${event.status.toUpperCase()}*\n\n` +
      `Position: \`${event.positionAddress.slice(0, 8)}...${event.positionAddress.slice(-8)}\`\n` +
      `Reason: ${event.reason}\n\n` +
      `Old Range: ${event.oldRange.lowerBinId} - ${event.oldRange.upperBinId}\n` +
      `New Range: ${event.newRange.lowerBinId} - ${event.newRange.upperBinId}\n\n` +
      (event.signature ? `Tx: \`${event.signature.slice(0, 8)}...\`` : "")
    );
  }

  private formatAlertMessage(alert: Alert): string {
    const emoji = {
      info: "ℹ️",
      warning: "⚠️",
      error: "❌",
      success: "✅",
    }[alert.type];

    return `${emoji} *${alert.title}*\n\n${alert.message}`;
  }

  private async sendMessage(message: string) {
    if (!this.config.botToken || !this.config.chatId) {
      console.log("Telegram not configured, skipping message:", message);
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: "Markdown",
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error("Failed to send Telegram message:", error);
      }
    } catch (error) {
      console.error("Error sending Telegram message:", error);
    }
  }

  async sendDailySummary(summary: {
    totalPositions: number;
    totalValue: number;
    totalFeesEarned: number;
    rebalancesToday: number;
    avgIL: number;
  }) {
    if (!this.config.enabled) return;

    const message =
      `📊 *Daily Summary*\n\n` +
      `Total Positions: ${summary.totalPositions}\n` +
      `Total Value: $${summary.totalValue.toFixed(2)}\n` +
      `Fees Earned: $${summary.totalFeesEarned.toFixed(2)}\n` +
      `Rebalances: ${summary.rebalancesToday}\n` +
      `Avg IL: ${summary.avgIL.toFixed(2)}%`;

    await this.sendMessage(message);
  }

  launch() {
    if (
      this.bot &&
      this.config.botToken &&
      this.config.botToken !== "mock_token"
    ) {
      this.bot.launch();
      logger.info(
        "Telegram bot launched successfully with interactive commands"
      );
    } else if (!this.config.botToken || this.config.botToken === "mock_token") {
      logger.info("Telegram bot in mock mode (no token provided)");
    }
  }

  stop() {
    if (this.bot) {
      this.bot.stop();
    }
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }
}

export const telegramBot = new TelegramBot();
