import { z } from "zod";

// Position schemas
export const PositionSchema = z.object({
  address: z.string(),
  poolAddress: z.string(),
  owner: z.string(),
  lowerBinId: z.number(),
  upperBinId: z.number(),
  liquidityX: z.string(),
  liquidityY: z.string(),
  feeX: z.string(),
  feeY: z.string(),
  rewardOne: z.string().optional(),
  rewardTwo: z.string().optional(),
  lastUpdatedAt: z.number().optional(),
  createdAt: z.number(),
});

export const PoolInfoSchema = z.object({
  address: z.string(),
  tokenX: z.object({
    mint: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  tokenY: z.object({
    mint: z.string(),
    symbol: z.string(),
    decimals: z.number(),
  }),
  binStep: z.number(),
  activeId: z.number(),
  currentPrice: z.number(),
  tvl: z.number(),
  volume24h: z.number(),
  fees24h: z.number(),
});

export const PositionDataSchema = z.object({
  position: PositionSchema,
  pool: PoolInfoSchema,
  currentValue: z.number(),
  feesEarned: z.object({
    tokenX: z.number(),
    tokenY: z.number(),
    total: z.number(),
  }),
  performance: z.object({
    totalReturn: z.number(),
    dailyYield: z.number(),
    impermanentLoss: z.number(),
  }),
  riskMetrics: z.object({
    concentration: z.number(),
    priceDistance: z.number(),
    utilizationRate: z.number(),
    isInRange: z.boolean(),
  }),
});

// Volatility schemas
export const VolatilityDataSchema = z.object({
  poolAddress: z.string(),
  volatility: z.number(),
  priceChange24h: z.number(),
  priceChange7d: z.number(),
  volume24h: z.number(),
  timestamp: z.number(),
});

// Rebalancing schemas
export const RebalanceParamsSchema = z.object({
  positionAddress: z.string(),
  newLowerBinId: z.number(),
  newUpperBinId: z.number(),
  reason: z.string(),
  // Optional: for manual rebalancing with user-specified liquidity
  liquidityAmountX: z.string().optional(),
  liquidityAmountY: z.string().optional(),
});

export const RebalanceEventSchema = z.object({
  id: z.string(),
  positionAddress: z.string(),
  timestamp: z.number(),
  oldRange: z.object({
    lowerBinId: z.number(),
    upperBinId: z.number(),
  }),
  newRange: z.object({
    lowerBinId: z.number(),
    upperBinId: z.number(),
  }),
  reason: z.string(),
  signature: z.string(),
  status: z.enum(["pending", "success", "failed"]),
});

// Alert schemas
export const AlertSchema = z.object({
  id: z.string(),
  type: z.enum(["info", "warning", "error", "success"]),
  title: z.string(),
  message: z.string(),
  positionAddress: z.string().optional(),
  timestamp: z.number(),
  read: z.boolean(),
});

// WebSocket message schemas
export const WSMessageSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("position_update"),
    data: PositionDataSchema,
  }),
  z.object({
    type: z.literal("price_update"),
    data: z.object({
      poolAddress: z.string(),
      price: z.number(),
      timestamp: z.number(),
    }),
  }),
  z.object({
    type: z.literal("alert"),
    data: AlertSchema,
  }),
  z.object({
    type: z.literal("rebalance_event"),
    data: RebalanceEventSchema,
  }),
  z.object({
    type: z.literal("auto_rebalance_status"),
    data: z.object({
      enabled: z.boolean(),
      threshold: z.number(),
      lastCheck: z.number().optional(),
    }),
  }),
  z.object({
    type: z.literal("rebalance_check"),
    data: z.object({
      positionAddress: z.string(),
      shouldRebalance: z.boolean(),
      reason: z.string(),
      timestamp: z.number(),
    }),
  }),
]);

// Stop Loss schemas
export const StopLossConfigSchema = z.object({
  positionAddress: z.string(),
  triggerPrice: z.number(),
  enabled: z.boolean(),
  createdAt: z.number(),
});

// API Response schemas
export const ApiResponseSchema = <T extends z.ZodType>(dataSchema: T) =>
  z.object({
    success: z.boolean(),
    data: dataSchema.optional(),
    error: z.string().optional(),
    timestamp: z.number(),
  });

// Export types
export type Position = z.infer<typeof PositionSchema>;
export type PoolInfo = z.infer<typeof PoolInfoSchema>;
export type PositionData = z.infer<typeof PositionDataSchema>;
export type VolatilityData = z.infer<typeof VolatilityDataSchema>;
export type RebalanceParams = z.infer<typeof RebalanceParamsSchema>;
export type RebalanceEvent = z.infer<typeof RebalanceEventSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type StopLossConfig = z.infer<typeof StopLossConfigSchema>;
export type WSMessage = z.infer<typeof WSMessageSchema>;
export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
};
