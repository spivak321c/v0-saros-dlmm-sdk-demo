import type { PositionData, RebalanceEvent, Alert, VolatilityData } from '../shared/schema';

// In-memory storage (replace with database in production)
class Storage {
  private positions: Map<string, PositionData> = new Map();
  private rebalanceEvents: RebalanceEvent[] = [];
  private alerts: Alert[] = [];
  private volatilityData: Map<string, VolatilityData> = new Map();
  private priceHistory: Map<string, Array<{ price: number; timestamp: number }>> = new Map();
  private initialPrices: Map<string, number> = new Map();

  // Positions
  setPosition(address: string, data: PositionData) {
    this.positions.set(address, data);
  }

  getPosition(address: string): PositionData | undefined {
    return this.positions.get(address);
  }

  getAllPositions(): PositionData[] {
    return Array.from(this.positions.values());
  }

  getUserPositions(owner: string): PositionData[] {
    return Array.from(this.positions.values()).filter(
      (pos) => pos.position.owner === owner
    );
  }

  deletePosition(address: string) {
    this.positions.delete(address);
  }

  // Rebalance events
  addRebalanceEvent(event: RebalanceEvent) {
    this.rebalanceEvents.push(event);
  }

  getRebalanceEvents(positionAddress?: string): RebalanceEvent[] {
    if (positionAddress) {
      return this.rebalanceEvents.filter((e) => e.positionAddress === positionAddress);
    }
    return this.rebalanceEvents;
  }

  // Alerts
  addAlert(alert: Alert) {
    this.alerts.push(alert);
  }

  getAlerts(unreadOnly = false): Alert[] {
    if (unreadOnly) {
      return this.alerts.filter((a) => !a.read);
    }
    return this.alerts;
  }

  markAlertRead(id: string) {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) {
      alert.read = true;
    }
  }

  // Volatility data
  setVolatilityData(poolAddress: string, data: VolatilityData) {
    this.volatilityData.set(poolAddress, data);
  }

  getVolatilityData(poolAddress: string): VolatilityData | undefined {
    return this.volatilityData.get(poolAddress);
  }

  // Price history
  addPricePoint(poolAddress: string, price: number, timestamp: number) {
    if (!this.priceHistory.has(poolAddress)) {
      this.priceHistory.set(poolAddress, []);
    }
    const history = this.priceHistory.get(poolAddress)!;
    history.push({ price, timestamp });
    
    // Keep only last 1000 points
    if (history.length > 1000) {
      history.shift();
    }
  }

  getPriceHistory(poolAddress: string, since?: number): Array<{ price: number; timestamp: number }> {
    const history = this.priceHistory.get(poolAddress) || [];
    if (since) {
      return history.filter((p) => p.timestamp >= since);
    }
    return history;
  }

  // Initial price tracking for IL calculation
  setInitialPrice(positionAddress: string, price: number) {
    this.initialPrices.set(positionAddress, price);
  }

  getInitialPrice(positionAddress: string): number | undefined {
    return this.initialPrices.get(positionAddress);
  }
}

export const storage = new Storage();
