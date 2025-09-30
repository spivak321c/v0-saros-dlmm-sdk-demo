import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "7d";

  // Generate mock analytics data based on time range
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;

  const portfolioHistory = Array.from({ length: days }, (_, i) => ({
    date: new Date(
      Date.now() - (days - i) * 24 * 60 * 60 * 1000
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    value: 50000 + Math.random() * 10000 + i * 500,
    fees: 500 + Math.random() * 200 + i * 20,
  }));

  const feeEarnings = Array.from({ length: days }, (_, i) => ({
    date: new Date(
      Date.now() - (days - i) * 24 * 60 * 60 * 1000
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    fees: 100 + Math.random() * 150,
    apy: 35 + Math.random() * 20,
  }));

  const positionPerformance = [
    { pool: "SOL/USDC", pnl: 2450, fees: 1200, apy: 42.5 },
    { pool: "USDC/USDT", pnl: 890, fees: 650, apy: 28.3 },
    { pool: "SOL/mSOL", pnl: 1560, fees: 890, apy: 35.7 },
    { pool: "RAY/USDC", pnl: -320, fees: 420, apy: 52.1 },
    { pool: "BONK/SOL", pnl: 3200, fees: 1800, apy: 68.4 },
  ];

  const rebalanceHistory = Array.from(
    { length: Math.floor(days / 2) },
    (_, i) => ({
      date: new Date(
        Date.now() - (days - i * 2) * 24 * 60 * 60 * 1000
      ).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count: Math.floor(Math.random() * 5) + 1,
      gasSpent: Math.random() * 2 + 0.5,
    })
  );

  const riskMetrics = {
    sharpeRatio: 1.85,
    maxDrawdown: -8.3,
    volatility: 12.4,
    winRate: 72.5,
  };

  const assetAllocation = [
    { name: "SOL", value: 35 },
    { name: "USDC", value: 30 },
    { name: "mSOL", value: 15 },
    { name: "Others", value: 20 },
  ];

  return NextResponse.json({
    portfolioHistory,
    feeEarnings,
    positionPerformance,
    rebalanceHistory,
    riskMetrics,
    assetAllocation,
  });
}
