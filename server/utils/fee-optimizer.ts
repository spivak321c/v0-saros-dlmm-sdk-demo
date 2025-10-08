import type { PoolInfo } from '../../shared/schema';

export enum FeeTier {
  STABLE = 1,    // 0.01% - for stable pairs
  LOW = 5,       // 0.05% - for correlated assets
  MEDIUM = 25,   // 0.25% - for standard pairs
  HIGH = 100,    // 1.00% - for volatile/exotic pairs
}

export interface FeeOptimizationResult {
  recommendedTier: FeeTier;
  reason: string;
  expectedApr: number;
}

export class FeeOptimizer {
  /**
   * Determine optimal fee tier based on pool volatility and characteristics
   */
  optimizeFeeTier(
    pool: PoolInfo,
    volatility: number,
    volume24h: number
  ): FeeOptimizationResult {
    // Stable pairs (very low volatility)
    if (volatility < 5) {
      return {
        recommendedTier: FeeTier.STABLE,
        reason: 'Low volatility detected - stable pair',
        expectedApr: this.estimateApr(volume24h, pool.tvl, FeeTier.STABLE),
      };
    }

    // Low volatility pairs
    if (volatility < 20) {
      return {
        recommendedTier: FeeTier.LOW,
        reason: 'Moderate volatility - correlated assets',
        expectedApr: this.estimateApr(volume24h, pool.tvl, FeeTier.LOW),
      };
    }

    // Medium volatility pairs
    if (volatility < 50) {
      return {
        recommendedTier: FeeTier.MEDIUM,
        reason: 'Standard volatility - typical trading pair',
        expectedApr: this.estimateApr(volume24h, pool.tvl, FeeTier.MEDIUM),
      };
    }

    // High volatility pairs
    return {
      recommendedTier: FeeTier.HIGH,
      reason: 'High volatility - exotic or volatile pair',
      expectedApr: this.estimateApr(volume24h, pool.tvl, FeeTier.HIGH),
    };
  }

  /**
   * Estimate APR based on volume, TVL, and fee tier
   */
  private estimateApr(volume24h: number, tvl: number, feeTier: FeeTier): number {
    if (tvl === 0) return 0;

    // Annual volume estimate
    const annualVolume = volume24h * 365;

    // Fee revenue
    const feeRevenue = annualVolume * (feeTier / 10000);

    // APR = (Fee Revenue / TVL) * 100
    return (feeRevenue / tvl) * 100;
  }

  /**
   * Compare fee tiers and recommend best option
   */
  compareFeeTiers(
    pool: PoolInfo,
    volatility: number,
    volume24h: number
  ): Record<FeeTier, FeeOptimizationResult> {
    const results: Record<FeeTier, FeeOptimizationResult> = {} as any;

    for (const tier of [FeeTier.STABLE, FeeTier.LOW, FeeTier.MEDIUM, FeeTier.HIGH]) {
      results[tier] = {
        recommendedTier: tier,
        reason: this.getFeeTierDescription(tier),
        expectedApr: this.estimateApr(volume24h, pool.tvl, tier),
      };
    }

    return results;
  }

  private getFeeTierDescription(tier: FeeTier): string {
    switch (tier) {
      case FeeTier.STABLE:
        return 'Stable pairs (0.01%)';
      case FeeTier.LOW:
        return 'Correlated assets (0.05%)';
      case FeeTier.MEDIUM:
        return 'Standard pairs (0.25%)';
      case FeeTier.HIGH:
        return 'Volatile pairs (1.00%)';
      default:
        return 'Unknown tier';
    }
  }
}

export const feeOptimizer = new FeeOptimizer();
