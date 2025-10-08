import type { RebalanceEvent, Alert } from '../../shared/schema';

interface TelegramConfig {
  botToken?: string;
  chatId?: string;
  enabled: boolean;
}

export class TelegramBot {
  private config: TelegramConfig = {
    enabled: false,
  };

  configure(botToken: string, chatId: string) {
    this.config = {
      botToken,
      chatId,
      enabled: true,
    };
    console.log('Telegram bot configured');
  }

  disable() {
    this.config.enabled = false;
    console.log('Telegram bot disabled');
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
    type: 'out_of_range' | 'high_il' | 'stop_loss',
    details: string
  ) {
    if (!this.config.enabled) return;

    const emoji = {
      out_of_range: '⚠️',
      high_il: '📉',
      stop_loss: '🛑',
    }[type];

    const title = {
      out_of_range: 'Position Out of Range',
      high_il: 'High Impermanent Loss',
      stop_loss: 'Stop-Loss Triggered',
    }[type];

    const message = `${emoji} *${title}*\n\nPosition: \`${positionAddress.slice(0, 8)}...${positionAddress.slice(-8)}\`\n\n${details}`;

    await this.sendMessage(message);
  }

  private formatRebalanceMessage(event: RebalanceEvent): string {
    const status = event.status === 'success' ? '✅' : event.status === 'failed' ? '❌' : '⏳';
    
    return `${status} *Rebalance ${event.status.toUpperCase()}*\n\n` +
      `Position: \`${event.positionAddress.slice(0, 8)}...${event.positionAddress.slice(-8)}\`\n` +
      `Reason: ${event.reason}\n\n` +
      `Old Range: ${event.oldRange.lowerBinId} - ${event.oldRange.upperBinId}\n` +
      `New Range: ${event.newRange.lowerBinId} - ${event.newRange.upperBinId}\n\n` +
      (event.signature ? `Tx: \`${event.signature.slice(0, 8)}...\`` : '');
  }

  private formatAlertMessage(alert: Alert): string {
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      success: '✅',
    }[alert.type];

    return `${emoji} *${alert.title}*\n\n${alert.message}`;
  }

  private async sendMessage(message: string) {
    if (!this.config.botToken || !this.config.chatId) {
      console.log('Telegram not configured, skipping message:', message);
      return;
    }

    try {
      const url = `https://api.telegram.org/bot${this.config.botToken}/sendMessage`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: 'Markdown',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('Failed to send Telegram message:', error);
      }
    } catch (error) {
      console.error('Error sending Telegram message:', error);
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

    const message = `📊 *Daily Summary*\n\n` +
      `Total Positions: ${summary.totalPositions}\n` +
      `Total Value: $${summary.totalValue.toFixed(2)}\n` +
      `Fees Earned: $${summary.totalFeesEarned.toFixed(2)}\n` +
      `Rebalances: ${summary.rebalancesToday}\n` +
      `Avg IL: ${summary.avgIL.toFixed(2)}%`;

    await this.sendMessage(message);
  }
}

export const telegramBot = new TelegramBot();
