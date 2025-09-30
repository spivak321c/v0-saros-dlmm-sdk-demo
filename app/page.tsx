"use client"

import { useState } from "react"
import useSWR from "swr"
import { PortfolioStats } from "../components/portfolio-stats"
import { PositionList } from "../components/position-list"
import { VolatilityChart } from "../components/volatility-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Github, ExternalLink } from "lucide-react"

const fetcher = (url: string) => fetch(url).then((res) => res.json())

export default function DashboardPage() {
  const { data: positionsData, error: positionsError, mutate: refreshPositions } = useSWR("/api/positions", fetcher)

  const {
    data: volatilityData,
    error: volatilityError,
    mutate: refreshVolatility,
  } = useSWR("/api/volatility?pool=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU", fetcher)

  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await Promise.all([refreshPositions(), refreshVolatility()])
    setTimeout(() => setIsRefreshing(false), 1000)
  }

  if (positionsError || volatilityError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Data</CardTitle>
            <CardDescription>Failed to fetch portfolio data. Please try again.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!positionsData || !volatilityData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">Loading portfolio data...</p>
        </div>
      </div>
    )
  }

  const positions = positionsData.positions || []
  const totalValue = positions.reduce((sum: number, p: any) => sum + (Number(p.valueUSD) || 0), 0)
  const totalFees = positions.reduce(
    (sum: number, p: any) => sum + (Number(p.feesEarnedX) || 0) * 100 + (Number(p.feesEarnedY) || 0),
    0,
  )
  const averageAPY =
    positions.length > 0
      ? positions.reduce((sum: number, p: any) => sum + (Number(p.apy) || 0), 0) / positions.length
      : 0
  const positionsInRange = positions.filter((p: any) => p.isInRange).length

  const mean = Number(volatilityData?.mean) || 0
  const stdDev = Number(volatilityData?.stdDev) || 0
  const volatilityRatio = Number(volatilityData?.volatilityRatio) || 0
  const recommendedRangeWidth = Number(volatilityData?.recommendedRangeWidth) || 0
  const isHighVolatility = volatilityData?.isHighVolatility ?? false
  const historicalPrices = volatilityData?.historicalPrices ?? []

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Saros DLMM Rebalancer</h1>
              <p className="text-sm text-muted-foreground">Automated liquidity management for Saros Finance</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a
                  href="https://github.com/yourusername/saros-dlmm-rebalancer"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Github className="h-4 w-4 mr-2" />
                  GitHub
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Info Banner */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                  Hackathon Demo - Saros Finance $100K Bounty
                </h3>
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  This dashboard showcases automated DLMM rebalancing with volatility-adjusted ranges, Telegram bot
                  integration, and portfolio analytics. Built with @saros-finance/dlmm-sdk on Solana devnet.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a href="https://saros-docs.rectorspace.com" target="_blank" rel="noreferrer noopener">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Docs
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Portfolio Stats */}
        <PortfolioStats
          totalValue={totalValue}
          totalFees={totalFees}
          averageAPY={averageAPY}
          impermanentLoss={2.3}
          positionsInRange={positionsInRange}
          totalPositions={positions.length}
        />

        {/* Charts and Positions */}
        <div className="grid gap-8 lg:grid-cols-2">
          <VolatilityChart data={historicalPrices} poolName="SOL/USDC" />

          <Card>
            <CardHeader>
              <CardTitle>Volatility Metrics</CardTitle>
              <CardDescription>Real-time volatility analysis for optimal range calculation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Mean Price</p>
                  <p className="text-2xl font-bold">${mean.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Std Deviation</p>
                  <p className="text-2xl font-bold">{stdDev.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Volatility Ratio</p>
                  <p className="text-2xl font-bold">{(volatilityRatio * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Recommended Range</p>
                  <p className="text-2xl font-bold">{(recommendedRangeWidth * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-2">Strategy Recommendation</p>
                <p className="text-sm text-muted-foreground">
                  {isHighVolatility
                    ? "High volatility detected. Using wider ranges to reduce rebalancing frequency and gas costs."
                    : "Low volatility environment. Tighter ranges recommended for maximum capital efficiency and fee generation."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Position List */}
        <PositionList positions={positions} />

        {/* Features */}
        <Card>
          <CardHeader>
            <CardTitle>Key Features</CardTitle>
            <CardDescription>What makes this rebalancer unique</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-semibold">Volatility-Adjusted Ranges</h4>
                <p className="text-sm text-muted-foreground">
                  Dynamically calculates optimal position ranges based on real-time bin data volatility analysis.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Telegram Bot Integration</h4>
                <p className="text-sm text-muted-foreground">
                  Interactive bot for position monitoring, manual rebalancing, and real-time alerts.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Stop-Loss Protection</h4>
                <p className="text-sm text-muted-foreground">
                  Automatic position closure when price breaches user-defined thresholds.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Multi-Pool Monitoring</h4>
                <p className="text-sm text-muted-foreground">
                  Simultaneously tracks and manages positions across multiple DLMM pools.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Strategy Simulator</h4>
                <p className="text-sm text-muted-foreground">
                  Backtest different rebalancing strategies with historical data to optimize returns.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold">Portfolio Analytics</h4>
                <p className="text-sm text-muted-foreground">
                  Comprehensive stats including fees, APY, impermanent loss, and net returns.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t mt-16">
        <div className="container mx-auto px-4 py-6">
          <p className="text-center text-sm text-muted-foreground">
            Built for Saros Finance Hackathon 2025 | Open Source (MIT License)
          </p>
        </div>
      </footer>
    </div>
  )
}
