"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, AlertCircle } from "lucide-react"

interface Position {
  positionId: string
  poolAddress: string
  tokenX: string
  tokenY: string
  lowerBin: number
  upperBin: number
  currentBin: number
  liquidityX: number
  liquidityY: number
  feesEarnedX: number
  feesEarnedY: number
  isInRange: boolean
  valueUSD: number
  apy: number
}

interface PositionListProps {
  positions: Position[]
}

export function PositionList({ positions }: PositionListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Active Positions</CardTitle>
        <CardDescription>Your DLMM liquidity positions across all pools</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {positions.map((position) => (
            <div
              key={position.positionId}
              className="flex items-start justify-between rounded-lg border p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">
                    {position.tokenX}/{position.tokenY}
                  </h3>
                  {position.isInRange ? (
                    <Badge variant="default" className="bg-green-600">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      In Range
                    </Badge>
                  ) : (
                    <Badge variant="destructive">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Out of Range
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Range</p>
                    <p className="font-mono">
                      {position.lowerBin} - {position.upperBin}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Bin</p>
                    <p className="font-mono">{position.currentBin}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Liquidity</p>
                    <p>
                      {position.liquidityX.toFixed(4)} {position.tokenX}
                    </p>
                    <p>
                      {position.liquidityY.toFixed(2)} {position.tokenY}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fees Earned</p>
                    <p className="text-green-600">
                      {position.feesEarnedX.toFixed(4)} {position.tokenX}
                    </p>
                    <p className="text-green-600">
                      {position.feesEarnedY.toFixed(2)} {position.tokenY}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>Position ID: {position.positionId}</span>
                  <span>Pool: {position.poolAddress.slice(0, 8)}...</span>
                </div>
              </div>

              <div className="text-right space-y-1">
                <p className="text-2xl font-bold">${position.valueUSD.toFixed(0)}</p>
                <p className="text-sm text-green-600">{position.apy.toFixed(2)}% APY</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
