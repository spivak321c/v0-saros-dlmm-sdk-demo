"use client";

import { useState } from "react";
import useSWR from "swr";
import { PortfolioStats } from "../components/portfolio-stats";
import { PositionList } from "../components/position-list";
import { VolatilityChart } from "../components/volatility-chart";
import { TelegramBotPanel } from "../components/telegram-bot-panel";
import { SarosLogo } from "../components/saros-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { RefreshCw, Github, ExternalLink, Wallet, Menu, X } from "lucide-react";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardPage() {
  const {
    data: positionsData,
    error: positionsError,
    mutate: refreshPositions,
  } = useSWR("/api/positions", fetcher);

  const {
    data: volatilityData,
    error: volatilityError,
    mutate: refreshVolatility,
  } = useSWR(
    "/api/volatility?pool=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    fetcher
  );

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isWalletConnected, setIsWalletConnected] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([refreshPositions(), refreshVolatility()]);
    setTimeout(() => setIsRefreshing(false), 1000);
  };

  if (positionsError || volatilityError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error Loading Data</CardTitle>
            <CardDescription>
              Failed to fetch portfolio data. Please try again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!positionsData || !volatilityData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading portfolio data...
          </p>
        </div>
      </div>
    );
  }

  const positions = positionsData.positions || [];
  const totalValue = positions.reduce(
    (sum: number, p: any) => sum + (p.valueUSD || 0),
    0
  );
  const totalFees = positions.reduce(
    (sum: number, p: any) =>
      sum + (p.feesEarnedX || 0) * 100 + (p.feesEarnedY || 0),
    0
  );
  const averageAPY =
    positions.length > 0
      ? positions.reduce((sum: number, p: any) => sum + (p.apy || 0), 0) /
        positions.length
      : 0;
  const positionsInRange = positions.filter((p: any) => p.isInRange).length;

  const mean = volatilityData?.mean ?? 0;
  const stdDev = volatilityData?.stdDev ?? 0;
  const volatilityRatio = volatilityData?.volatilityRatio ?? 0;
  const recommendedRangeWidth = volatilityData?.recommendedRangeWidth ?? 0;
  const isHighVolatility = volatilityData?.isHighVolatility ?? false;
  const historicalPrices = volatilityData?.historicalPrices ?? [];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-6">
              <SarosLogo />
              <nav className="hidden md:flex items-center gap-6">
                <Link
                  href="/"
                  className="text-sm font-medium hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/pools"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Pools
                </Link>
                <Link
                  href="/analytics"
                  className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                >
                  Analytics
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="hidden sm:flex bg-transparent"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
                <span className="ml-2">Refresh</span>
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="sm:hidden bg-transparent"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
                />
              </Button>
              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 hidden sm:flex"
                onClick={() => setIsWalletConnected(!isWalletConnected)}
              >
                <Wallet className="h-4 w-4" />
                <span className="ml-2">
                  {isWalletConnected ? "Connected" : "Connect"}
                </span>
              </Button>
              <Button
                size="icon"
                className="bg-primary hover:bg-primary/90 sm:hidden"
                onClick={() => setIsWalletConnected(!isWalletConnected)}
              >
                <Wallet className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
            </div>
          </div>
          {isMobileMenuOpen && (
            <nav className="md:hidden pt-4 pb-2 space-y-2 border-t mt-3">
              <Link
                href="/"
                className="block px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Dashboard
              </Link>
              <Link
                href="/pools"
                className="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Pools
              </Link>
              <Link
                href="/analytics"
                className="block px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Analytics
              </Link>
            </nav>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
        <div className="rounded-xl bg-gradient-to-r from-purple-500/10 via-purple-500/5 to-transparent border border-purple-200/50 dark:border-purple-800/50 p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-base sm:text-lg mb-2">
                Automated DLMM Liquidity Rebalancer
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Production-ready tool for Saros DLMM pools with
                volatility-adjusted ranges, Telegram bot integration, and
                advanced portfolio analytics.
              </p>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none bg-transparent"
                asChild
              >
                <a
                  href="https://saros-docs.rectorspace.com"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  <ExternalLink className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Docs</span>
                </a>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 sm:flex-none bg-transparent"
                asChild
              >
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

        {/* Portfolio Stats */}
        <PortfolioStats
          totalValue={totalValue}
          totalFees={totalFees}
          averageAPY={averageAPY}
          impermanentLoss={2.3}
          positionsInRange={positionsInRange}
          totalPositions={positions.length}
        />

        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <VolatilityChart data={historicalPrices} poolName="SOL/USDC" />

            <Card>
              <CardHeader>
                <CardTitle className="text-base sm:text-lg">
                  Volatility Metrics
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Real-time volatility analysis for optimal range calculation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      Mean Price
                    </p>
                    <p className="text-xl sm:text-2xl font-bold">
                      ${mean.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      Std Deviation
                    </p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {stdDev.toFixed(2)}
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      Volatility Ratio
                    </p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {(volatilityRatio * 100).toFixed(2)}%
                    </p>
                  </div>
                  <div className="p-3 sm:p-4 rounded-lg bg-muted/50">
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      Recommended Range
                    </p>
                    <p className="text-xl sm:text-2xl font-bold">
                      {(recommendedRangeWidth * 100).toFixed(1)}%
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <div className="flex items-start gap-3">
                    <div
                      className={`h-2 w-2 rounded-full mt-2 flex-shrink-0 ${
                        isHighVolatility ? "bg-orange-500" : "bg-green-500"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-xs sm:text-sm font-medium mb-1">
                        Strategy Recommendation
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                        {isHighVolatility
                          ? "High volatility detected. Using wider ranges to reduce rebalancing frequency and gas costs."
                          : "Low volatility environment. Tighter ranges recommended for maximum capital efficiency and fee generation."}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <TelegramBotPanel isConnected={false} />
          </div>
        </div>

        {/* Position List */}
        <PositionList positions={positions} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">Key Features</CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Production-ready automated liquidity management
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full bg-primary/20" />
                </div>
                <h4 className="font-semibold text-sm sm:text-base">
                  Volatility-Adjusted Ranges
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Dynamically calculates optimal position ranges based on
                  real-time bin data volatility analysis.
                </p>
              </div>
              <div className="space-y-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full bg-primary/20" />
                </div>
                <h4 className="font-semibold text-sm sm:text-base">
                  Telegram Bot Integration
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Interactive bot for position monitoring, manual rebalancing,
                  and real-time alerts.
                </p>
              </div>
              <div className="space-y-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full bg-primary/20" />
                </div>
                <h4 className="font-semibold text-sm sm:text-base">
                  Stop-Loss Protection
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Automatic position closure when price breaches user-defined
                  thresholds.
                </p>
              </div>
              <div className="space-y-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full bg-primary/20" />
                </div>
                <h4 className="font-semibold text-sm sm:text-base">
                  Multi-Pool Monitoring
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Simultaneously tracks and manages positions across multiple
                  DLMM pools.
                </p>
              </div>
              <div className="space-y-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full bg-primary/20" />
                </div>
                <h4 className="font-semibold text-sm sm:text-base">
                  Strategy Simulator
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Backtest different rebalancing strategies with historical data
                  to optimize returns.
                </p>
              </div>
              <div className="space-y-3 p-4 rounded-lg border bg-card hover:shadow-md transition-shadow">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <div className="h-5 w-5 rounded-full bg-primary/20" />
                </div>
                <h4 className="font-semibold text-sm sm:text-base">
                  Portfolio Analytics
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                  Comprehensive stats including fees, APY, impermanent loss, and
                  net returns.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <footer className="border-t mt-8 sm:mt-12 bg-muted/30">
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <SarosLogo className="h-5 sm:h-6" />
              <span className="text-xs sm:text-sm text-muted-foreground">
                DLMM Rebalancer
              </span>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground text-center">
              Built for Saros Finance Hackathon 2025 | Open Source (MIT License)
            </p>
            <div className="flex items-center gap-4">
              <a
                href="#"
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Docs
              </a>
              <a
                href="#"
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                GitHub
              </a>
              <a
                href="#"
                className="text-xs sm:text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                Telegram
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
