import { PublicKey, Keypair } from "@solana/web3.js";
import storage from "../storage";
import { dlmmClient } from "../solana/dlmm-client";
import { telegramBot } from "./telegram-bot";

interface StopLossConfig {
  positionAddress: string;
  enabled: boolean;
  lossThreshold: number; // Percentage loss to trigger
  impermanentLossThreshold: number; // IL percentage to trigger
}

export class StopLossManager {
  private configs: Map<string, StopLossConfig> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;
  private readonly CHECK_INTERVAL = 60000; // 1 minute

  setStopLoss(config: StopLossConfig) {
    this.configs.set(config.positionAddress, config);
  }

  removeStopLoss(positionAddress: string) {
    this.configs.delete(positionAddress);
  }

  getStopLoss(positionAddress: string): StopLossConfig | undefined {
    return this.configs.get(positionAddress);
  }

  async checkStopLoss(
    positionAddress: string,
    owner: Keypair
  ): Promise<boolean> {
    const config = this.configs.get(positionAddress);
    if (!config || !config.enabled) {
      return false;
    }

    const positionData = storage.getPosition(positionAddress);
    if (!positionData) {
      return false;
    }

    const { performance } = positionData;

    // Check total return threshold
    if (performance.totalReturn <= -config.lossThreshold) {
      await this.executeStopLoss(
        positionAddress,
        owner,
        "Total loss threshold exceeded"
      );
      return true;
    }

    // Check impermanent loss threshold
    if (performance.impermanentLoss >= config.impermanentLossThreshold) {
      await this.executeStopLoss(
        positionAddress,
        owner,
        "Impermanent loss threshold exceeded"
      );
      return true;
    }

    return false;
  }

  private async executeStopLoss(
    positionAddress: string,
    owner: Keypair,
    reason: string
  ) {
    try {
      console.log(`Executing stop-loss for ${positionAddress}: ${reason}`);

      const positionData = storage.getPosition(positionAddress);
      if (!positionData) {
        throw new Error("Position not found");
      }

      // Remove all liquidity
      const result = await dlmmClient.removeLiquidity(
        positionData.position,
        10000, // 100%
        owner
      );

      // Add alert
      const alert = {
        id: `alert_${Date.now()}`,
        type: "warning" as const,
        title: "Stop-Loss Triggered",
        message: `Position ${positionAddress.slice(0, 8)}... closed due to: ${reason}`,
        positionAddress,
        timestamp: Date.now(),
        read: false,
      };
      storage.addAlert(alert);

      // Send Telegram notification
      await telegramBot.sendAlert(alert);
      await telegramBot.sendPositionAlert(
        positionAddress,
        "stop_loss",
        `Reason: ${reason}\nTransaction: ${result}`
      );

      // Remove position from storage
      storage.deletePosition(positionAddress);

      // Remove stop-loss config
      this.configs.delete(positionAddress);

      console.log(`Stop-loss executed successfully: ${result}`);
    } catch (error) {
      console.error(
        `Failed to execute stop-loss for ${positionAddress}:`,
        error
      );

      const errorAlert = {
        id: `alert_${Date.now()}`,
        type: "error" as const,
        title: "Stop-Loss Failed",
        message: `Failed to execute stop-loss: ${error instanceof Error ? error.message : "Unknown error"}`,
        positionAddress,
        timestamp: Date.now(),
        read: false,
      };
      storage.addAlert(errorAlert);
      await telegramBot.sendAlert(errorAlert);
    }
  }

  startMonitoring(owner: Keypair) {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    this.checkInterval = setInterval(async () => {
      for (const [positionAddress] of this.configs) {
        await this.checkStopLoss(positionAddress, owner);
      }
    }, this.CHECK_INTERVAL);

    console.log("Stop-loss monitoring started");
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log("Stop-loss monitoring stopped");
    }
  }
}

export const stopLossManager = new StopLossManager();
