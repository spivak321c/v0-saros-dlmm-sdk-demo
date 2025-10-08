/**
 * Server Configuration
 * Environment variables and constants for Saros DLMM integration
 */

export const config = {
  // Solana RPC Configuration
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
    network: process.env.SOLANA_NETWORK || 'mainnet-beta',
    commitment: 'confirmed' as const,
  },

  // Wallet Configuration
  wallet: {
    privateKey: process.env.WALLET_PRIVATE_KEY || '',
  },

  // Telegram Bot Configuration
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },

  // Saros DLMM Configuration
  saros: {
    programId: process.env.SAROS_PROGRAM_ID || 'SarosV1DLMM1111111111111111111111111111111',
    maxRetries: 3,
    retryDelay: 1000, // ms
  },

  // Volatility Calculation Settings
  volatility: {
    defaultPeriod: 24, // hours
    minDataPoints: 10,
    confidenceLevel: 0.95,
  },

  // Rebalancing Settings
  rebalancing: {
    intervalMinutes: parseInt(process.env.REBALANCE_INTERVAL_MINUTES || '15'),
    volatilityThreshold: parseFloat(process.env.VOLATILITY_THRESHOLD || '0.05'),
    outOfRangeThreshold: parseFloat(process.env.OUT_OF_RANGE_THRESHOLD || '0.1'),
    minFeeThreshold: parseFloat(process.env.MIN_FEE_THRESHOLD || '0.001'),
    minVolatilityThreshold: 0.05, // 5%
    maxVolatilityThreshold: 0.50, // 50%
    defaultSlippageBps: 50, // 0.5%
    maxSlippageBps: 500, // 5%
  },

  // Stop-Loss Settings
  stopLoss: {
    enabled: process.env.ENABLE_STOP_LOSS === 'true',
    percentage: parseFloat(process.env.STOP_LOSS_PERCENTAGE || '0.15'),
    defaultThreshold: 0.10, // 10% loss
    checkIntervalMs: 60000, // 1 minute
  },

  // Monitored Pools
  pools: {
    monitored: process.env.MONITORED_POOLS?.split(',').map(p => p.trim()) || [],
  },

  // Automation Settings
  automation: {
    rebalanceIntervalMs: 3600000, // 1 hour
    monitoringIntervalMs: 300000, // 5 minutes
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableConsole: true,
  },
} as const;

export type Config = typeof config;
