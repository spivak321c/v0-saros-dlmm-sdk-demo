import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Activity, 
  AlertTriangle,
  Info,
  BarChart3,
  Coins,
  Target,
  Clock
} from 'lucide-react';
import type { PositionData } from '../../shared/schema';

interface PositionDetailModalProps {
  position: PositionData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PositionDetailModal({ position, open, onOpenChange }: PositionDetailModalProps) {
  if (!position) return null;

  const { pool, currentValue, feesEarned, performance, riskMetrics } = position;
  const isInRange = riskMetrics?.isInRange ?? false;
  const totalReturn = performance?.totalReturn || 0;
  const dailyYield = performance?.dailyYield || 0;
  const impermanentLoss = performance?.impermanentLoss || 0;

  // Calculate position age
  const positionAge = Date.now() - (position.position.createdAt || Date.now());
  const daysOld = Math.floor(positionAge / (1000 * 60 * 60 * 24));
  const hoursOld = Math.floor((positionAge % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Calculate range metrics
  const rangeWidth = position.position.upperBinId - position.position.lowerBinId;
  const currentBin = pool.activeId;
  const distanceToLower = currentBin - position.position.lowerBinId;
  const distanceToUpper = position.position.upperBinId - currentBin;
  const rangeUtilization = isInRange 
    ? ((Math.min(distanceToLower, distanceToUpper) / rangeWidth) * 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-2xl">
                {pool?.tokenX?.symbol || 'Unknown'}/{pool?.tokenY?.symbol || 'Unknown'}
              </DialogTitle>
              <p className="text-sm text-muted-foreground font-mono">
                {position.position.address}
              </p>
            </div>
            <Badge 
              variant={isInRange ? 'default' : 'destructive'}
              className="font-medium"
            >
              {isInRange ? '● Active' : '● Inactive'}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="liquidity">Liquidity</TabsTrigger>
            <TabsTrigger value="risk">Risk</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Position Value
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">${currentValue.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Current liquidity value
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Coins className="h-4 w-4" />
                    Fees Earned
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-green-600">
                    ${(feesEarned?.total || 0).toFixed(2)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Total trading fees
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Total Return
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Including fees & IL
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Position Age
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">
                    {daysOld}d {hoursOld}h
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Time active
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Pool Information */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Pool Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Pool Address</p>
                    <p className="text-sm font-mono mt-1">{pool.address.slice(0, 20)}...</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Current Price</p>
                    <p className="text-sm font-semibold mt-1">
                      {pool.currentPrice.toFixed(6)} {pool.tokenX.symbol}/{pool.tokenY.symbol}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Bin</p>
                    <p className="text-sm font-semibold mt-1">{pool.activeId}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bin Step</p>
                    <p className="text-sm font-semibold mt-1">{pool.binStep}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Range Status */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Price Range Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Lower Bin</span>
                    <span className="font-mono font-semibold">{position.position.lowerBinId}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current Bin</span>
                    <span className="font-mono font-semibold text-primary">{currentBin}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Upper Bin</span>
                    <span className="font-mono font-semibold">{position.position.upperBinId}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Range Width</span>
                    <span className="font-semibold">{rangeWidth} bins</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Position in Range</span>
                    <span className="font-semibold">{rangeUtilization.toFixed(1)}%</span>
                  </div>
                </div>

                {!isInRange && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-red-500">Position Out of Range</p>
                      <p className="text-xs text-muted-foreground">
                        Your liquidity is not earning fees. Consider rebalancing to the current price range.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Daily Yield */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Daily Yield</span>
                    <span className="text-lg font-bold text-green-600">
                      {(dailyYield * 100).toFixed(4)}%
                    </span>
                  </div>
                  <Progress value={Math.min(dailyYield * 1000, 100)} className="h-2" />
                </div>

                {/* APY */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Estimated APY</span>
                    <span className="text-lg font-bold text-green-600">
                      {(dailyYield * 365 * 100).toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Annualized based on current daily yield
                  </p>
                </div>

                {/* Impermanent Loss */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Impermanent Loss</span>
                    <span className={`text-lg font-bold ${impermanentLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {impermanentLoss >= 0 ? '+' : ''}{impermanentLoss.toFixed(2)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min(Math.abs(impermanentLoss), 100)} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Loss from price divergence vs. holding tokens
                  </p>
                </div>

                {/* Net Return */}
                <div className="p-4 rounded-lg bg-secondary/50 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Net Return (Fees - IL)</span>
                    <span className={`text-xl font-bold ${(totalReturn) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Total performance including all factors
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Fee Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Coins className="h-5 w-5" />
                  Fee Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium">{pool.tokenX.symbol} Fees</p>
                    <p className="text-xs text-muted-foreground mt-1">Token X earnings</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{(feesEarned?.tokenX || 0).toFixed(6)}</p>
                    <p className="text-xs text-muted-foreground">${(feesEarned?.tokenX || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                  <div>
                    <p className="text-sm font-medium">{pool.tokenY.symbol} Fees</p>
                    <p className="text-xs text-muted-foreground mt-1">Token Y earnings</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold">{(feesEarned?.tokenY || 0).toFixed(6)}</p>
                    <p className="text-xs text-muted-foreground">${(feesEarned?.tokenY || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <div>
                    <p className="text-sm font-medium text-green-600">Total Fees (USD)</p>
                    <p className="text-xs text-muted-foreground mt-1">Combined value</p>
                  </div>
                  <p className="text-xl font-bold text-green-600">
                    ${(feesEarned?.total || 0).toFixed(2)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Liquidity Tab */}
          <TabsContent value="liquidity" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Liquidity Composition
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">{pool.tokenX.symbol} Amount</p>
                      <p className="text-xs text-muted-foreground mt-1">Token X liquidity</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{parseFloat(position.position.liquidityX).toFixed(6)}</p>
                      <p className="text-xs text-muted-foreground">
                        ${(parseFloat(position.position.liquidityX)).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-secondary/30">
                    <div>
                      <p className="text-sm font-medium">{pool.tokenY.symbol} Amount</p>
                      <p className="text-xs text-muted-foreground mt-1">Token Y liquidity</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{parseFloat(position.position.liquidityY).toFixed(6)}</p>
                      <p className="text-xs text-muted-foreground">
                        ${(parseFloat(position.position.liquidityY) * pool.currentPrice).toFixed(2)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Total Liquidity Value</span>
                    <span className="text-xl font-bold text-primary">
                      ${currentValue.toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Token Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <p className="text-sm font-medium">{pool.tokenX.symbol}</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {pool.tokenX.mint}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Decimals: {pool.tokenX.decimals}
                  </p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">{pool.tokenY.symbol}</p>
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {pool.tokenY.mint}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Decimals: {pool.tokenY.decimals}
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Risk Tab */}
          <TabsContent value="risk" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Risk Metrics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Concentration Risk */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Concentration Risk</span>
                    <span className="text-sm font-bold">
                      {((riskMetrics?.concentration || 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((riskMetrics?.concentration || 0) * 100, 100)} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Higher = narrower range = more risk but higher fees
                  </p>
                </div>

                {/* Price Distance */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Price Distance</span>
                    <span className="text-sm font-bold">
                      {((riskMetrics?.priceDistance || 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <Progress 
                    value={Math.min((riskMetrics?.priceDistance || 0) * 100, 100)} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Distance from current price to range edge
                  </p>
                </div>

                {/* Utilization Rate */}
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Utilization Rate</span>
                    <span className="text-sm font-bold text-green-600">
                      {((riskMetrics?.utilizationRate || 0) * 100).toFixed(2)}%
                    </span>
                  </div>
                  <Progress 
                    value={(riskMetrics?.utilizationRate || 0) * 100} 
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground">
                    Percentage of capital actively earning fees
                  </p>
                </div>

                {/* Risk Assessment */}
                <div className={`p-4 rounded-lg border ${
                  isInRange 
                    ? 'bg-green-500/10 border-green-500/20' 
                    : 'bg-red-500/10 border-red-500/20'
                }`}>
                  <p className="text-sm font-medium mb-2">
                    {isInRange ? '✓ Position is Active' : '⚠ Position Needs Attention'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {isInRange 
                      ? 'Your liquidity is in range and earning trading fees.'
                      : 'Price has moved outside your range. Rebalance to resume earning fees.'
                    }
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {!isInRange && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-yellow-600">Rebalance Recommended</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Your position is out of range and not earning fees
                      </p>
                    </div>
                  </div>
                )}

                {(feesEarned?.total || 0) > 1 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Coins className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-green-600">Collect Fees</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        You have ${(feesEarned?.total || 0).toFixed(2)} in uncollected fees
                      </p>
                    </div>
                  </div>
                )}

                {(riskMetrics?.concentration || 0) > 0.1 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-blue-600">High Concentration</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Narrow range = higher risk. Consider widening if volatility increases
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button className="flex-1">
            Manage Position
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
