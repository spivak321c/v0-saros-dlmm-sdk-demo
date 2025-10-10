import type {
  PositionData,
  RebalanceEvent,
  Alert,
  VolatilityData,
  StopLossConfig,
} from "../shared/schema";
import fs from "fs";
import path from "path";

const STORAGE_FILE = path.join(__dirname, "file.json");

interface StorageData {
  positions: Record<string, PositionData>;
  rebalanceEvents: RebalanceEvent[];
  alerts: Alert[];
  stopLossConfigs: Record<string, StopLossConfig>;
  settings: {
    telegram: {
      enabled: boolean;
      botToken: string;
      chatId: string;
    };
    rebalancing: {
      enabled: boolean;
      intervalMinutes: number;
      volatilityThreshold: number;
    };
    monitoring: {
      enabled: boolean;
      pools: string[];
    };
  };
}

// In-memory storage with JSON file persistence
class Storage {
  private data: StorageData;
  private volatilityData: Map<string, VolatilityData> = new Map();
  private priceHistory: Map<
    string,
    Array<{ price: number; timestamp: number }>
  > = new Map();
  private initialPrices: Map<string, number> = new Map();

  constructor() {
    this.data = this.loadFromFile();
  }

  private loadFromFile(): StorageData {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const fileContent = fs.readFileSync(STORAGE_FILE, "utf-8");
        return JSON.parse(fileContent);
      }
    } catch (error) {
      console.error("Failed to load storage file:", error);
    }
    return {
      positions: {},
      rebalanceEvents: [],
      alerts: [],
      stopLossConfigs: {},
      settings: {
        telegram: { enabled: false, botToken: "", chatId: "" },
        rebalancing: {
          enabled: false,
          intervalMinutes: 15,
          volatilityThreshold: 0.05,
        },
        monitoring: { enabled: false, pools: [] },
      },
    };
  }

  private saveToFile() {
    try {
      fs.writeFileSync(
        STORAGE_FILE,
        JSON.stringify(this.data, null, 2),
        "utf-8"
      );
    } catch (error) {
      console.error("Failed to save storage file:", error);
    }
  }

  // Positions
  public setPosition(address: string, data: PositionData) {
    this.data.positions[address] = data;
    this.saveToFile();
  }

  public getPosition(address: string): PositionData | undefined {
    return this.data.positions[address];
  }

  public getAllPositions(): PositionData[] {
    return Object.values(this.data.positions);
  }

  public getUserPositions(owner: string): PositionData[] {
    return Object.values(this.data.positions).filter(
      (pos) => pos.position.owner === owner
    );
  }

  public deletePosition(address: string) {
    delete this.data.positions[address];
    this.saveToFile();
  }

  // Rebalance events
  public addRebalanceEvent(event: RebalanceEvent) {
    this.data.rebalanceEvents.push(event);
    this.saveToFile();
  }

  public getRebalanceEvents(positionAddress?: string): RebalanceEvent[] {
    if (positionAddress) {
      return this.data.rebalanceEvents.filter(
        (e) => e.positionAddress === positionAddress
      );
    }
    return this.data.rebalanceEvents;
  }

  // Alerts
  public addAlert(alert: Alert) {
    this.data.alerts.push(alert);
    this.saveToFile();
  }

  public getAlerts(unreadOnly: boolean = false): Alert[] {
    if (unreadOnly) {
      return this.data.alerts.filter((a) => !a.read);
    }
    return this.data.alerts;
  }

  public markAlertRead(id: string) {
    const alert = this.data.alerts.find((a) => a.id === id);
    if (alert) {
      alert.read = true;
      this.saveToFile();
    }
  }

  // Stop-loss configs
  public setStopLoss(config: StopLossConfig) {
    this.data.stopLossConfigs[config.positionAddress] = config;
    this.saveToFile();
  }

  public getStopLoss(positionAddress: string): StopLossConfig | undefined {
    return this.data.stopLossConfigs[positionAddress];
  }

  public removeStopLoss(positionAddress: string) {
    delete this.data.stopLossConfigs[positionAddress];
    this.saveToFile();
  }

  public getAllStopLossConfigs(): StopLossConfig[] {
    return Object.values(this.data.stopLossConfigs);
  }

  // Settings management
  public getSettings() {
    // Return flattened settings for frontend compatibility
    return {
      autoRebalance: this.data.settings.rebalancing?.enabled || false,
      rebalanceThreshold: this.data.settings.rebalancing?.volatilityThreshold
        ? this.data.settings.rebalancing.volatilityThreshold * 100
        : 5,
      autoCollectFees: true,
      feeThreshold: 10,
      stopLossEnabled: false,
      stopLossThreshold: 10,
      monitoredWallet: (this.data.settings as any).monitoredWallet || null,
      telegram: this.data.settings.telegram,
      rebalancing: this.data.settings.rebalancing,
      monitoring: this.data.settings.monitoring,
    };
  }

  public updateSettings(settings: Partial<StorageData["settings"]>) {
    this.data.settings = { ...this.data.settings, ...settings };
    this.saveToFile();
  }

  public saveSettings(settings: any) {
    // Handle both flat and nested settings from frontend
    if (settings.autoRebalance !== undefined) {
      this.data.settings.rebalancing.enabled = settings.autoRebalance;
    }
    if (settings.rebalanceThreshold !== undefined) {
      this.data.settings.rebalancing.volatilityThreshold =
        settings.rebalanceThreshold / 100;
    }
    if (settings.monitoredWallet !== undefined) {
      (this.data.settings as any).monitoredWallet = settings.monitoredWallet;
    }
    if (settings.autoCollectFees !== undefined) {
      // Store in settings for future use
    }
    if (settings.feeThreshold !== undefined) {
      // Store in settings for future use
    }
    if (settings.stopLossEnabled !== undefined) {
      // Store in settings for future use
    }
    if (settings.stopLossThreshold !== undefined) {
      // Store in settings for future use
    }
    // Merge any nested settings objects
    if (settings.telegram) {
      this.data.settings.telegram = {
        ...this.data.settings.telegram,
        ...settings.telegram,
      };
    }
    if (settings.rebalancing) {
      this.data.settings.rebalancing = {
        ...this.data.settings.rebalancing,
        ...settings.rebalancing,
      };
    }
    if (settings.monitoring) {
      this.data.settings.monitoring = {
        ...this.data.settings.monitoring,
        ...settings.monitoring,
      };
    }
    this.saveToFile();
  }

  public getTelegramSettings() {
    return this.data.settings.telegram;
  }

  public updateTelegramSettings(
    telegram: Partial<StorageData["settings"]["telegram"]>
  ) {
    this.data.settings.telegram = {
      ...this.data.settings.telegram,
      ...telegram,
    };
    this.saveToFile();
  }

  // Volatility data (in-memory only)
  public setVolatilityData(poolAddress: string, data: VolatilityData) {
    this.volatilityData.set(poolAddress, data);
  }

  public getVolatilityData(poolAddress: string): VolatilityData | undefined {
    return this.volatilityData.get(poolAddress);
  }

  // Price history (in-memory only)
  public addPricePoint(poolAddress: string, price: number, timestamp: number) {
    if (!this.priceHistory.has(poolAddress)) {
      this.priceHistory.set(poolAddress, []);
    }
    this.priceHistory.get(poolAddress)!.push({ price, timestamp });
  }

  public getPriceHistory(
    poolAddress: string
  ): Array<{ price: number; timestamp: number }> {
    return this.priceHistory.get(poolAddress) || [];
  }

  // Initial prices (in-memory only)
  public setInitialPrice(positionAddress: string, price: number) {
    this.initialPrices.set(positionAddress, price);
  }

  public getInitialPrice(positionAddress: string): number | undefined {
    return this.initialPrices.get(positionAddress);
  }
}

export const storage = new Storage();
export default storage;
