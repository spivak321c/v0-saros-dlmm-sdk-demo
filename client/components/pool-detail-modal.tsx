import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  BarChart3,
  Coins,
  Droplets,
  Percent,
  Clock,
  Users,
} from "lucide-react";

interface Pool {
  address: string;
  name: string;
  tokenX: {
    symbol: string;
    mint: string;
    decimals: number;
  };
  tokenY: {
    symbol: string;
    mint: string;
    decimals: number;
  };
  binStep: number;
  baseFeePercentage: string;
  maxFeePercentage?: string;
  protocolFeePercentage?: string;
  liquidity: string;
  reserveX: string;
  reserveY: string;
  reserveXAmount: number;
  reserveYAmount: number;
  currentPrice?: number;
  activeId: number;
  fees24h?: number;
  volume24h?: number;
  tvl?: number;
}

interface PoolDetailModalProps {
  pool: Pool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  volatilityData?: {
    volatility: number;
    priceChange24h: number;
    volumeChange24h: number;
    lastUpdate: number;
  };
}

export function PoolDetailModal({
  pool,
  open,
  onOpenChange,
  volatilityData,
}: PoolDetailModalProps) {
  if (!pool) return null;

  const baseFee = parseFloat(pool.baseFeePercentage || "0");
  const maxFee = parseFloat(pool.maxFeePercentage || "0");
  const protocolFee = parseFloat(pool.protocolFeePercentage || "0");
  const tvl = pool.tvl || parseFloat(pool.liquidity || "0");
  const volume24h = pool.volume24h || 0;
  const fees24h = pool.fees24h || 0;

  // Calculate utilization metrics
  const reserveXUSD = pool.reserveXAmount * (pool.currentPrice || 0);
  const reserveYUSD = pool.reserveYAmount;
  const totalReserveUSD = reserveXUSD + reserveYUSD;
  const reserveRatio =
    totalReserveUSD > 0 ? (reserveXUSD / totalReserveUSD) * 100 : 50;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-2xl">
                {pool.tokenX?.symbol || "Unknown"}/
                {pool.tokenY?.symbol || "Unknown"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {pool.name || "DLMM Pool"}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {pool.address}
              </p>
            </div>
            <Badge variant="outline" className="font-medium">
              Bin Step: {pool.binStep}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
            <TabsTrigger value="volatility">Volatility</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    TVL
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    ${tvl?.toFixed(2) || "0.00"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total Value Locked
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    24h Volume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    ${volume24h?.toFixed(2) || "0.00"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Trading volume
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    24h Fees
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    ${fees24h?.toFixed(2) || "0.00"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Protocol fees earned
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Current Price
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    ${(pool.currentPrice || 0).toFixed(6)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {pool.tokenX?.symbol}/{pool.tokenY?.symbol}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Pool Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Pool Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Active Bin ID
                    </p>
                    <p className="text-lg font-semibold">{pool.activeId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Bin Step
                    </p>
                    <p className="text-lg font-semibold">{pool.binStep} bps</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Base Fee
                    </p>
                    <p className="text-lg font-semibold">
                      {baseFee.toFixed(4)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Max Fee
                    </p>
                    <p className="text-lg font-semibold">
                      {maxFee.toFixed(4)}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Token Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    {pool.tokenX?.symbol || "Token X"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Mint Address
                    </p>
                    <p className="text-sm font-mono break-all">
                      {pool.tokenX?.mint}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Decimals</p>
                    <p className="text-sm font-semibold">
                      {pool.tokenX?.decimals}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reserve</p>
                    <p className="text-sm font-semibold">
                      {pool.reserveXAmount?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    {pool.tokenY?.symbol || "Token Y"}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div>
                    <p className="text-xs text-muted-foreground">
                      Mint Address
                    </p>
                    <p className="text-sm font-mono break-all">
                      {pool.tokenY?.mint}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Decimals</p>
                    <p className="text-sm font-semibold">
                      {pool.tokenY?.decimals}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Reserve</p>
                    <p className="text-sm font-semibold">
                      {pool.reserveYAmount?.toFixed(2) || "0.00"}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Liquidity Tab */}
          <TabsContent value="liquidity" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Droplets className="h-5 w-5" />
                  Liquidity Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">
                      {pool.tokenX?.symbol} Reserve
                    </span>
                    <span className="text-sm font-semibold">
                      {reserveRatio?.toFixed(1) || "0.0"}%
                    </span>
                  </div>
                  <Progress value={reserveRatio} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {pool.reserveXAmount?.toFixed(2) || "0.00"}{" "}
                    {pool.tokenX?.symbol} (${reserveXUSD?.toFixed(2) || "0.00"})
                  </p>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">
                      {pool.tokenY?.symbol} Reserve
                    </span>
                    <span className="text-sm font-semibold">
                      {(100 - (reserveRatio || 0))?.toFixed(1) || "0.0"}%
                    </span>
                  </div>
                  <Progress value={100 - reserveRatio} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-1">
                    {pool.reserveYAmount?.toFixed(2) || "0.00"}{" "}
                    {pool.tokenY?.symbol} (${reserveYUSD?.toFixed(2) || "0.00"})
                  </p>
                </div>

                <div className="pt-4 border-t">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Total Liquidity
                      </p>
                      <p className="text-xl font-bold">
                        ${totalReserveUSD?.toFixed(2) || "0.00"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">
                        Pool Balance
                      </p>
                      <p className="text-xl font-bold">
                        {reserveRatio > 60
                          ? "X Heavy"
                          : reserveRatio < 40
                          ? "Y Heavy"
                          : "Balanced"}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fees Tab */}
          <TabsContent value="fees" className="space-y-4 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Base Fee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{baseFee.toFixed(4)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Minimum trading fee
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Max Fee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{maxFee.toFixed(4)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Maximum trading fee
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Percent className="h-4 w-4" />
                    Protocol Fee
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {protocolFee.toFixed(4)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Protocol share
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Fee Performance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between mb-2">
                    <span className="text-sm font-medium">
                      24h Fees Collected
                    </span>
                    <span className="text-sm font-semibold text-green-600">
                      ${fees24h.toFixed(2)}
                    </span>
                  </div>
                  <Progress
                    value={Math.min((fees24h / (tvl || 1)) * 100 * 365, 100)}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Estimated APR:{" "}
                    {((fees24h / (tvl || 1)) * 365 * 100).toFixed(2)}%
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Fee/Volume Ratio
                    </p>
                    <p className="text-lg font-semibold">
                      {volume24h > 0
                        ? ((fees24h / volume24h) * 100).toFixed(4)
                        : "0.0000"}
                      %
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      Daily Fee Yield
                    </p>
                    <p className="text-lg font-semibold">
                      {tvl > 0 ? ((fees24h / tvl) * 100).toFixed(4) : "0.0000"}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Volatility Tab */}
          <TabsContent value="volatility" className="space-y-4 mt-4">
            {volatilityData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Volatility
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">
                        {volatilityData.volatility.toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Price volatility metric
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        24h Price Change
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={`text-2xl font-bold ${
                          volatilityData.priceChange24h >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {volatilityData.priceChange24h >= 0 ? "+" : ""}
                        {volatilityData.priceChange24h.toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Price movement
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <BarChart3 className="h-4 w-4" />
                        24h Volume Change
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p
                        className={`text-2xl font-bold ${
                          volatilityData.volumeChange24h >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {volatilityData.volumeChange24h >= 0 ? "+" : ""}
                        {volatilityData.volumeChange24h.toFixed(2)}%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Volume trend
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="h-5 w-5" />
                      Last Updated
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {new Date(volatilityData.lastUpdate).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">
                    No volatility data available
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Volatility metrics will appear here once data is collected
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
