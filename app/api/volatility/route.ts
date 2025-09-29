import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const poolAddress = searchParams.get("pool")

    // Mock volatility data
    const volatilityData = {
      poolAddress,
      mean: 8100,
      stdDev: 120,
      volatilityRatio: 0.0148,
      isHighVolatility: false,
      recommendedRangeWidth: 0.12,
      historicalPrices: Array.from({ length: 50 }, (_, i) => ({
        timestamp: Date.now() - (50 - i) * 3600000,
        price: 8100 + (Math.random() - 0.5) * 200,
      })),
    }

    return NextResponse.json(volatilityData)
  } catch (error) {
    console.error("Error fetching volatility:", error)
    return NextResponse.json({ error: "Failed to fetch volatility" }, { status: 500 })
  }
}
