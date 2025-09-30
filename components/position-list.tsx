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
        <CardTitle className="text-base sm:text-lg">Active Positions</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Your DLMM liquidity positions across all pools</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 sm:space-y-4">
          {positions.map((position) => (
            <div
              key={position.positionId}
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between rounded-lg border p-3 sm:p-4 hover:bg-accent/50 transition-colors gap-3 sm:gap-0"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-sm sm:text-base">
                    {position.tokenX}/{position.tokenY}
                  </h3>
                  {position.isInRange ? (
                    <Badge variant="default" className="bg-green-600 text-xs">
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      In Range
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Out of Range
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <p className="text-muted-foreground">Range</p>
                    <p className="font-mono text-xs sm:text-sm">
                      {position.lowerBin} - {position.upperBin}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Current Bin</p>
                    <p className="font-mono text-xs sm:text-sm">{position.currentBin}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Liquidity</p>
                    <p className="text-xs sm:text-sm">
                      {position.liquidityX.toFixed(4)} {position.tokenX}
                    </p>
                    <p className="text-xs sm:text-sm">
                      {position.liquidityY.toFixed(2)} {position.tokenY}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fees Earned</p>
                    <p className="text-green-600 text-xs sm:text-sm">
                      {position.feesEarnedX.toFixed(4)} {position.tokenX}
                    </p>
                    <p className="text-green-600 text-xs sm:text-sm">
                      {position.feesEarnedY.toFixed(2)} {position.tokenY}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-[10px] sm:text-xs text-muted-foreground">
                  <span className="truncate">Position ID: {position.positionId}</span>
                  <span className="truncate">Pool: {position.poolAddress.slice(0, 8)}...</span>
                </div>
              </div>

              <div className="text-left sm:text-right space-y-1 border-t sm:border-t-0 pt-3 sm:pt-0">
                <p className="text-xl sm:text-2xl font-bold">${position.valueUSD.toFixed(0)}</p>
                <p className="text-xs sm:text-sm text-green-600">{position.apy.toFixed(2)}% APY</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
