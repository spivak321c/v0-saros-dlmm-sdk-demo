import { Connection } from "@solana/web3.js"
import dotenv from "dotenv"

dotenv.config()

export const config = {
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    network: process.env.SOLANA_NETWORK || "devnet",
  },
  wallet: {
    privateKey: process.env.WALLET_PRIVATE_KEY || "",
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || "",
    chatId: process.env.TELEGRAM_CHAT_ID || "",
  },
  rebalancer: {
    intervalMinutes: Number.parseInt(process.env.REBALANCE_INTERVAL_MINUTES || "15"),
    volatilityThreshold: Number.parseFloat(process.env.VOLATILITY_THRESHOLD || "0.05"),
    outOfRangeThreshold: Number.parseFloat(process.env.OUT_OF_RANGE_THRESHOLD || "0.1"),
    minFeeThreshold: Number.parseFloat(process.env.MIN_FEE_THRESHOLD || "0.001"),
  },
  pools: {
    monitored: (process.env.MONITORED_POOLS || "").split(",").filter(Boolean),
  },
  stopLoss: {
    enabled: process.env.ENABLE_STOP_LOSS === "true",
    percentage: Number.parseFloat(process.env.STOP_LOSS_PERCENTAGE || "0.15"),
  },
  analytics: {
    apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api",
    port: Number.parseInt(process.env.PORT || "3000"),
  },
}

export const getConnection = (): Connection => {
  return new Connection(config.solana.rpcUrl, "confirmed")
}

export const validateConfig = (): void => {
  const required = ["WALLET_PRIVATE_KEY", "TELEGRAM_BOT_TOKEN", "MONITORED_POOLS"]

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`)
  }
}
