import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';
import type { PositionData } from '../../shared/schema';

interface PositionCardProps {
  position: PositionData;
  onCollectFees?: () => void;
  onRebalance?: () => void;
}

export function PositionCard({ position, onCollectFees, onRebalance }: PositionCardProps) {
  const { pool, currentValue, feesEarned, performance, riskMetrics } = position;
  const isInRange = riskMetrics.isInRange;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {pool.tokenX.symbol}/{pool.tokenY.symbol}
          </CardTitle>
          <Badge variant={isInRange ? 'default' : 'destructive'}>
            {isInRange ? 'In Range' : 'Out of Range'}
          </Badge>
        </div>
        <p className="text-sm text-gray-500">
          {position.position.address.slice(0, 8)}...
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Value */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Position Value</span>
          <span className="font-semibold">${currentValue.toLocaleString()}</span>
        </div>

        {/* Performance */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Total Return</span>
          <span className={`font-semibold ${performance.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {performance.totalReturn >= 0 ? '+' : ''}{performance.totalReturn.toFixed(2)}%
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Daily Yield</span>
          <span className="font-semibold">{performance.dailyYield.toFixed(2)}%</span>
        </div>

        {/* Fees */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Fees Earned</span>
          <span className="font-semibold text-green-600">
            ${feesEarned.total.toLocaleString()}
          </span>
        </div>

        {/* Range visualization */}
        <div>
          <div className="text-sm text-gray-600 mb-2">Price Range</div>
          <Progress value={isInRange ? 100 - riskMetrics.priceDistance * 100 : 0} />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{position.position.lowerBinId}</span>
            <span className="font-medium">Current</span>
            <span>{position.position.upperBinId}</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onCollectFees}
            disabled={feesEarned.total < 0.01}
          >
            <DollarSign className="h-4 w-4 mr-1" />
            Collect
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={onRebalance}
          >
            <TrendingUp className="h-4 w-4 mr-1" />
            Rebalance
          </Button>
        </div>

        {/* Warnings */}
        {!isInRange && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800">Position out of range</span>
          </div>
        )}

        {performance.impermanentLoss > 10 && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-red-800">
              High IL: {performance.impermanentLoss.toFixed(2)}%
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
