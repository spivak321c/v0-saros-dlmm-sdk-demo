/**
 * Impermanent Loss Calculator
 * Formula: IL = 2√r / (1 + r) - 1
 * where r = price_ratio (current_price / initial_price)
 */

export interface ImpermanentLossResult {
  impermanentLoss: number; // Percentage
  hodlValue: number;
  lpValue: number;
  absoluteLoss: number;
}

export class ImpermanentLossCalculator {
  /**
   * Calculate impermanent loss using the standard formula
   * IL = 2√r / (1 + r) - 1
   */
  calculateIL(initialPrice: number, currentPrice: number): number {
    if (initialPrice <= 0 || currentPrice <= 0) {
      throw new Error('Prices must be positive');
    }

    const priceRatio = currentPrice / initialPrice;
    const sqrtRatio = Math.sqrt(priceRatio);
    
    // IL = 2√r / (1 + r) - 1
    const il = (2 * sqrtRatio) / (1 + priceRatio) - 1;
    
    // Return as percentage (negative value indicates loss)
    return il * 100;
  }

  /**
   * Calculate detailed IL with HODL comparison
   */
  calculateDetailedIL(
    initialPrice: number,
    currentPrice: number,
    initialAmountX: number,
    initialAmountY: number,
    feesEarned: number = 0
  ): ImpermanentLossResult {
    const priceRatio = currentPrice / initialPrice;
    
    // HODL value: what you would have if you just held the tokens
    const hodlValue = initialAmountX * currentPrice + initialAmountY;
    
    // LP value: current value in the pool
    // Using constant product formula: x * y = k
    const k = initialAmountX * initialAmountY;
    const currentAmountX = Math.sqrt(k / currentPrice);
    const currentAmountY = Math.sqrt(k * currentPrice);
    const lpValue = currentAmountX * currentPrice + currentAmountY;
    
    // Add fees to LP value
    const lpValueWithFees = lpValue + feesEarned;
    
    // Absolute loss
    const absoluteLoss = lpValueWithFees - hodlValue;
    
    // IL percentage
    const il = this.calculateIL(initialPrice, currentPrice);
    
    return {
      impermanentLoss: il,
      hodlValue,
      lpValue: lpValueWithFees,
      absoluteLoss,
    };
  }

  /**
   * Calculate IL for different price scenarios
   */
  calculateILScenarios(initialPrice: number): Map<number, number> {
    const scenarios = new Map<number, number>();
    
    // Price multipliers to test
    const multipliers = [0.5, 0.75, 0.9, 1.0, 1.1, 1.25, 1.5, 2.0, 3.0, 5.0];
    
    for (const multiplier of multipliers) {
      const currentPrice = initialPrice * multiplier;
      const il = this.calculateIL(initialPrice, currentPrice);
      scenarios.set(multiplier, il);
    }
    
    return scenarios;
  }

  /**
   * Calculate break-even fee APR needed to offset IL
   */
  calculateBreakEvenFeeAPR(
    initialPrice: number,
    currentPrice: number,
    daysElapsed: number
  ): number {
    const il = Math.abs(this.calculateIL(initialPrice, currentPrice));
    
    if (daysElapsed === 0) return 0;
    
    // Annualize the IL
    const annualizedIL = (il / daysElapsed) * 365;
    
    return annualizedIL;
  }

  /**
   * Estimate IL risk level
   */
  assessILRisk(il: number): {
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
  } {
    const absIL = Math.abs(il);
    
    if (absIL < 1) {
      return {
        level: 'low',
        description: 'Minimal impermanent loss',
      };
    } else if (absIL < 5) {
      return {
        level: 'medium',
        description: 'Moderate impermanent loss - monitor position',
      };
    } else if (absIL < 10) {
      return {
        level: 'high',
        description: 'Significant impermanent loss - consider rebalancing',
      };
    } else {
      return {
        level: 'critical',
        description: 'Critical impermanent loss - immediate action recommended',
      };
    }
  }
}

export const ilCalculator = new ImpermanentLossCalculator();
