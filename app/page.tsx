"use client"

import { useState } from "react"
import useSWR from "swr"
import { PortfolioStats } from "../components/portfolio-stats"
import { PositionList } from "../components/position-list"
import { VolatilityChart } from "../components/volatility-chart"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { RefreshCw, Github, ExternalLink } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

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
      <div className="flex items-center justify-center min-h-screen px-4">
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
      <div className="flex items-center justify-center min-h-screen px-4">
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
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Saros DLMM Rebalancer</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Automated liquidity management for Saros Finance
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex-1 sm:flex-none bg-transparent"
              >
                <RefreshCw className={`h-4 w-4 sm:mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Refresh</span>
              </Button>
              <Button variant="outline" size="sm" asChild className="flex-1 sm:flex-none bg-transparent">
                <a
                  href="https://github.com/yourusername/saros-dlmm-rebalancer"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <Github className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">GitHub</span>
                </a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 space-y-4 sm:space-y-8">
        {/* Info Banner */}
        <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-4 sm:pt-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 text-sm sm:text-base">
                  Hackathon Demo - Saros Finance $100K Bounty
                </h3>
                <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200">
                  This dashboard showcases automated DLMM rebalancing with volatility-adjusted ranges, Telegram bot
                  integration, and portfolio analytics. Built with @saros-finance/dlmm-sdk on Solana devnet.
                </p>
              </div>
              <Button variant="outline" size="sm" asChild className="w-full sm:w-auto bg-transparent">
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
        <div className="grid gap-4 sm:gap-8 lg:grid-cols-2">
          <VolatilityChart data={historicalPrices} poolName="SOL/USDC" />

          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">Volatility Metrics</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Real-time volatility analysis for optimal range calculation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Mean Price</p>
                  <p className="text-xl sm:text-2xl font-bold">${mean.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Std Deviation</p>
                  <p className="text-xl sm:text-2xl font-bold">{stdDev.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Volatility Ratio</p>
                  <p className="text-xl sm:text-2xl font-bold">{(volatilityRatio * 100).toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Recommended Range</p>
                  <p className="text-xl sm:text-2xl font-bold">{(recommendedRangeWidth * 100).toFixed(1)}%</p>
                </div>
              </div>

              <div className="pt-4 border-t">
                <p className="text-xs sm:text-sm font-medium mb-2">Strategy Recommendation</p>
                <p className="text-xs sm:text-sm text-muted-foreground">
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
            <CardTitle className="text-base sm:text-lg">Key Features</CardTitle>
            <CardDescription className="text-xs sm:text-sm">What makes this rebalancer unique</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <h4 className="font-semibold text-sm sm:text-base">Volatility-Adjusted Ranges</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Dynamically calculates optimal position ranges based on real-time bin data volatility analysis.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm sm:text-base">Telegram Bot Integration</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Interactive bot for position monitoring, manual rebalancing, and real-time alerts.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm sm:text-base">Stop-Loss Protection</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Automatic position closure when price breaches user-defined thresholds.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm sm:text-base">Multi-Pool Monitoring</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Simultaneously tracks and manages positions across multiple DLMM pools.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm sm:text-base">Strategy Simulator</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Backtest different rebalancing strategies with historical data to optimize returns.
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-semibold text-sm sm:text-base">Portfolio Analytics</h4>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Comprehensive stats including fees, APY, impermanent loss, and net returns.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 sm:mt-16">
        <div className="container mx-auto px-4 py-4 sm:py-6">
          <p className="text-center text-xs sm:text-sm text-muted-foreground">
            Built for Saros Finance Hackathon 2025 | Open Source (MIT License)
          </p>
        </div>
      </footer>
    </div>
  )
}
