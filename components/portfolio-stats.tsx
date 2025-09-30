"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Activity } from "lucide-react";

interface PortfolioStatsProps {
  totalValue: number;
  totalFees: number;
  averageAPY: number;
  impermanentLoss: number;
  positionsInRange: number;
  totalPositions: number;
}

export function PortfolioStats({
  totalValue,
  totalFees,
  averageAPY,
  impermanentLoss,
  positionsInRange,
  totalPositions,
}: PortfolioStatsProps) {
  const netReturn = averageAPY - impermanentLoss;

  return (
    <div className="grid gap-3 sm:gap-4 grid-cols-1 xs:grid-cols-2 lg:grid-cols-4">
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Total Value
          </CardTitle>
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <DollarSign className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold">
            ${totalValue.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Across {totalPositions} positions
          </p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Fees Earned
          </CardTitle>
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 dark:text-green-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-500">
            ${totalFees.toFixed(2)}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Average APY: {averageAPY.toFixed(2)}%
          </p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Net Return
          </CardTitle>
          <div
            className={`h-7 w-7 sm:h-8 sm:w-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
              netReturn >= 0 ? "bg-green-500/10" : "bg-red-500/10"
            }`}
          >
            <Activity
              className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${
                netReturn >= 0
                  ? "text-green-600 dark:text-green-500"
                  : "text-red-600 dark:text-red-500"
              }`}
            />
          </div>
        </CardHeader>
        <CardContent>
          <div
            className={`text-xl sm:text-2xl font-bold ${
              netReturn >= 0
                ? "text-green-600 dark:text-green-500"
                : "text-red-600 dark:text-red-500"
            }`}
          >
            {netReturn >= 0 ? "+" : ""}
            {netReturn.toFixed(2)}%
          </div>
          <p className="text-xs text-muted-foreground mt-1">APY minus IL</p>
        </CardContent>
      </Card>

      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xs sm:text-sm font-medium">
            Position Status
          </CardTitle>
          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg bg-orange-500/10 flex items-center justify-center flex-shrink-0">
            <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-600 dark:text-orange-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="text-xl sm:text-2xl font-bold">
            {positionsInRange}/{totalPositions}
          </div>
          <p className="text-xs text-muted-foreground mt-1">In optimal range</p>
        </CardContent>
      </Card>
    </div>
  );
}
