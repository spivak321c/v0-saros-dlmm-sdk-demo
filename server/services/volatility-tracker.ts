import { storage } from '../storage';
import { dlmmClient } from '../solana/dlmm-client';
import { PublicKey } from '@solana/web3.js';
import type { VolatilityData } from '../../shared/schema';

export class VolatilityTracker {
  private trackingInterval: NodeJS.Timeout | null = null;
  private readonly UPDATE_INTERVAL = 60000; // 1 minute

  calculateVolatility(poolAddress: string, timeframe: number = 86400000): number {
    const priceHistory = storage.getPriceHistory(poolAddress, Date.now() - timeframe);
    
    if (priceHistory.length < 2) {
      return 0;
    }

    // Calculate returns
    const returns: number[] = [];
    for (let i = 1; i < priceHistory.length; i++) {
      const returnValue = Math.log(priceHistory[i].price / priceHistory[i - 1].price);
      returns.push(returnValue);
    }

    // Calculate standard deviation
    const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);

    // Annualize volatility
    const periodsPerYear = 365 * 24 * 60; // Minutes in a year
    const annualizedVolatility = stdDev * Math.sqrt(periodsPerYear) * 100;

    return annualizedVolatility;
  }

  calculatePriceChange(poolAddress: string, timeframe: number): number {
    const priceHistory = storage.getPriceHistory(poolAddress, Date.now() - timeframe);
    
    if (priceHistory.length < 2) {
      return 0;
    }

    const oldestPrice = priceHistory[0].price;
    const latestPrice = priceHistory[priceHistory.length - 1].price;
    
    return ((latestPrice - oldestPrice) / oldestPrice) * 100;
  }

  async updateVolatilityData(poolAddress: string) {
    const volatility = this.calculateVolatility(poolAddress);
    const priceChange24h = this.calculatePriceChange(poolAddress, 86400000);
    const priceChange7d = this.calculatePriceChange(poolAddress, 604800000);

    // Fetch current pool data for volume
    let volume24h = 0;
    try {
      const poolInfo = await dlmmClient.getPoolInfo(new PublicKey(poolAddress));
      volume24h = poolInfo.volume24h;
    } catch (error) {
      console.error('Failed to fetch pool volume:', error);
    }

    const volatilityData: VolatilityData = {
      poolAddress,
      volatility,
      priceChange24h,
      priceChange7d,
      volume24h,
      timestamp: Date.now(),
    };

    storage.setVolatilityData(poolAddress, volatilityData);
    return volatilityData;
  }

  async startTracking(poolAddresses: string[]) {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
    }

    // Initial update
    for (const address of poolAddresses) {
      await this.updateVolatilityData(address);
    }

    this.trackingInterval = setInterval(async () => {
      for (const address of poolAddresses) {
        await this.updateVolatilityData(address);
      }
    }, this.UPDATE_INTERVAL);

    console.log('Volatility tracking started for', poolAddresses.length, 'pools');
  }

  stopTracking() {
    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
      console.log('Volatility tracking stopped');
    }
  }

  getVolatilityData(poolAddress: string): VolatilityData | undefined {
    return storage.getVolatilityData(poolAddress);
  }
}

export const volatilityTracker = new VolatilityTracker();
