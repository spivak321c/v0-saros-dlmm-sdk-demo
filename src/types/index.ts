import type { PublicKey } from "@solana/web3.js"
import type BN from "bn.js"

export interface DLMMPoolInfo {
  address: PublicKey
  tokenX: {
    mint: PublicKey
    symbol: string
    decimals: number
  }
  tokenY: {
    mint: PublicKey
    symbol: string
    decimals: number
  }
  activeId: number // Current active bin ID
  feeTier: number // Fee in basis points (1, 5, 30, 100)
  binStep: number // Price increment between bins in basis points
}

export interface PoolConfig {
  address: PublicKey
  tokenX: string
  tokenY: string
  feeTier: number
  binStep: number
}

export interface Position {
  positionId: string
  poolAddress: string
  lowerBin: number
  upperBin: number
  liquidityX: BN
  liquidityY: BN
  feesEarned: {
    tokenX: BN
    tokenY: BN
  }
  currentPrice: number
  isInRange: boolean
}

export interface BinData {
  binId: number
  price: number
  liquidityX: BN
  liquidityY: BN
  supply: BN
}

export interface LiquidityParams {
  lowerBin: number
  upperBin: number
  amountX: BN
  amountY: BN
  slippage: number // Slippage tolerance (e.g., 0.01 for 1%)
}

export interface VolatilityData {
  stdDev: number
  mean: number
  recentPrices: number[]
  timestamp: number
}

export interface RebalanceAction {
  positionId: string
  poolAddress: string
  action: "rebalance" | "stop-loss" | "none"
  reason: string
  oldRange: { lower: number; upper: number }
  newRange?: { lower: number; upper: number }
  timestamp: number
}

export interface PortfolioStats {
  totalPositions: number
  totalValueUSD: number
  totalFeesEarned: number
  positionsInRange: number
  positionsOutOfRange: number
  averageAPY: number
  impermanentLoss: number
}

export interface SimulationResult {
  strategy: string
  totalFees: number
  impermanentLoss: number
  netReturn: number
  rebalanceCount: number
  gasSpent: number
}
