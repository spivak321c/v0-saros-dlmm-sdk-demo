/**
 * Type definitions for Saros DLMM server
 */

import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

// Position Types
export interface DLMMPosition {
  publicKey: PublicKey;
  owner: PublicKey;
  pool: PublicKey;
  lowerBinId: number;
  upperBinId: number;
  liquidity: BN;
  feeX: BN;
  feeY: BN;
  rewardOne: BN;
  rewardTwo: BN;
  lastUpdatedAt: number;
}

export interface PositionMetrics {
  position: DLMMPosition;
  currentValue: number;
  unrealizedPnL: number;
  feeEarned: number;
  rewardsEarned: number;
  utilizationRate: number;
  activeBinId: number;
  inRange: boolean;
}

// Volatility Types
export interface VolatilityData {
  period: number; // hours
  volatility: number; // annualized volatility
  priceChanges: number[];
  meanReturn: number;
  standardDeviation: number;
  calculatedAt: number;
}

export interface RiskMetrics {
  volatility: VolatilityData;
  valueAtRisk: number; // VaR at 95% confidence
  sharpeRatio: number;
  maxDrawdown: number;
  currentRisk: "low" | "medium" | "high";
}

// Rebalancing Types
export interface RebalanceParams {
  positionKey: PublicKey;
  targetVolatility: number;
  slippageBps: number;
  minLiquidity?: BN;
  maxLiquidity?: BN;
  // For manual rebalancing: user-specified liquidity amounts
  liquidityAmountX?: BN;
  liquidityAmountY?: BN;
}

export interface RebalanceResult {
  success: boolean;
  oldRange: { lower: number; upper: number };
  newRange: { lower: number; upper: number };
  liquidityAdjusted: BN;
  txSignature?: string;
  error?: string;
  timestamp: number;
}

// Strategy Simulation Types
export interface SimulationParams {
  initialLiquidity: BN;
  priceRange: { lower: number; upper: number };
  volatilityTarget: number;
  duration: number; // hours
  rebalanceFrequency: number; // hours
  feeRate: number; // bps
}

export interface SimulationResult {
  totalReturn: number;
  feesEarned: number;
  rebalanceCount: number;
  maxDrawdown: number;
  sharpeRatio: number;
  finalValue: number;
  timeline: SimulationSnapshot[];
}

export interface SimulationSnapshot {
  timestamp: number;
  price: number;
  liquidity: BN;
  value: number;
  feesAccumulated: number;
  inRange: boolean;
}

// Stop-Loss Types
export interface StopLossConfig {
  positionKey: PublicKey;
  threshold: number; // percentage loss
  enabled: boolean;
  notifyOnly: boolean; // if true, only notify, don't execute
}

export interface StopLossEvent {
  positionKey: PublicKey;
  currentLoss: number;
  threshold: number;
  triggered: boolean;
  executed: boolean;
  txSignature?: string;
  timestamp: number;
}

// Automation Types
export interface AutomationJob {
  id: string;
  type: "rebalance" | "monitor" | "stop-loss";
  positionKey: PublicKey;
  config: Record<string, any>;
  enabled: boolean;
  lastRun?: number;
  nextRun?: number;
}

export interface AutomationResult {
  jobId: string;
  success: boolean;
  action: string;
  details: Record<string, any>;
  timestamp: number;
  error?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: number;
}

// Pool Types
export interface PoolInfo {
  publicKey: PublicKey;
  tokenX: PublicKey;
  tokenY: PublicKey;
  binStep: number;
  activeId: number;
  reserveX: BN;
  reserveY: BN;
  protocolFee: number;
  liquidity: BN;
}

// Price History
export interface PricePoint {
  timestamp: number;
  price: number;
  volume?: number;
}
