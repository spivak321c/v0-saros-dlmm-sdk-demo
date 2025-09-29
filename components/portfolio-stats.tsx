"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react"

interface PortfolioStatsProps {
  totalValue: number
  totalFees: number
  averageAPY: number
  impermanentLoss: number
  positionsInRange: number
  totalPositions: number
}

export function PortfolioStats({
  totalValue,
  totalFees,
  averageAPY,
  impermanentLoss,
  positionsInRange,
  totalPositions,
}: PortfolioStatsProps) {
  const netReturn = averageAPY - impermanentLoss

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Value</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Across {totalPositions} positions</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Fees Earned</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">${totalFees.toFixed(2)}</div>
          <p className="text-xs text-muted-foreground">Average APY: {averageAPY.toFixed(2)}%</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Return</CardTitle>
          <Activity className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${netReturn >= 0 ? "text-green-600" : "text-red-600"}`}>
            {netReturn >= 0 ? "+" : ""}
            {netReturn.toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground">APY minus IL</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Position Status</CardTitle>
          <TrendingDown className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {positionsInRange}/{totalPositions}
          </div>
          <p className="text-xs text-muted-foreground">In optimal range</p>
        </CardContent>
      </Card>
    </div>
  )
}
