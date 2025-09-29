import { NextResponse } from "next/server"

// Mock data for demo - in production, this would fetch from blockchain
export async function GET() {
  try {
    // Mock positions data
    const positions = [
      {
        positionId: "pos_abc123",
        poolAddress: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
        tokenX: "SOL",
        tokenY: "USDC",
        lowerBin: 8000,
        upperBin: 8200,
        currentBin: 8150,
        liquidityX: 1.5,
        liquidityY: 150.0,
        feesEarnedX: 0.025,
        feesEarnedY: 2.5,
        isInRange: true,
        valueUSD: 300.0,
        apy: 18.5,
      },
      {
        positionId: "pos_def456",
        poolAddress: "8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV",
        tokenX: "SOL",
        tokenY: "USDT",
        lowerBin: 7900,
        upperBin: 8100,
        currentBin: 8180,
        liquidityX: 2.0,
        liquidityY: 200.0,
        feesEarnedX: 0.018,
        feesEarnedY: 1.8,
        isInRange: false,
        valueUSD: 400.0,
        apy: 15.2,
      },
      {
        positionId: "pos_ghi789",
        poolAddress: "9xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsW",
        tokenX: "USDC",
        tokenY: "USDT",
        lowerBin: 9950,
        upperBin: 10050,
        currentBin: 10000,
        liquidityX: 500.0,
        liquidityY: 500.0,
        feesEarnedX: 5.2,
        feesEarnedY: 5.2,
        isInRange: true,
        valueUSD: 1000.0,
        apy: 12.8,
      },
    ]

    return NextResponse.json({ positions })
  } catch (error) {
    console.error("Error fetching positions:", error)
    return NextResponse.json({ error: "Failed to fetch positions" }, { status: 500 })
  }
}
