import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletPositions } from '../hooks/use-wallet-positions';
import { WalletButton } from '../components/wallet-button';
import { WebSocketStatus } from '../components/websocket-status';
import { MetricCard } from '../components/metric-card';
import { PositionCard } from '../components/position-card';
import { PositionCreator } from '../components/position-creator';
import { DollarSign, TrendingUp, Activity, Percent } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const { publicKey } = useWallet();
  const { data: positions, isLoading, refetch } = useWalletPositions();
  const [showCreatePosition, setShowCreatePosition] = useState(false);

  console.log('[Dashboard] Render state:', { 
    publicKey: publicKey?.toString(), 
    positionsCount: positions?.length, 
    isLoading 
  });

  if (!publicKey) {
    console.log('[Dashboard] No wallet connected');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold">Saros LP Dashboard</h1>
          <p className="text-gray-600">Connect your wallet to view and manage positions</p>
          <WalletButton />
        </div>
      </div>
    );
  }

  if (isLoading) {
    console.log('[Dashboard] Loading positions...');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading positions...</p>
        </div>
      </div>
    );
  }

  const totalValue = positions?.reduce((sum, pos) => sum + pos.currentValue, 0) || 0;
  const totalFees = positions?.reduce((sum, pos) => sum + pos.feesEarned.total, 0) || 0;
  const avgYield = positions?.length
    ? positions.reduce((sum, pos) => sum + pos.performance.dailyYield, 0) / positions.length
    : 0;
  const inRangeCount = positions?.filter((pos) => pos.riskMetrics.isInRange).length || 0;

  console.log('[Dashboard] Calculated metrics:', { totalValue, totalFees, avgYield, inRangeCount });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Overview of your liquidity positions</p>
        </div>
        <div className="flex items-center gap-4">
          <WebSocketStatus />
          <WalletButton />
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Portfolio Value"
          value={`$${totalValue.toLocaleString()}`}
          icon={DollarSign}
          color="blue"
        />
        <MetricCard
          title="Total Fees Earned"
          value={`$${totalFees.toLocaleString()}`}
          icon={TrendingUp}
          color="green"
        />
        <MetricCard
          title="Avg Daily Yield"
          value={`${avgYield.toFixed(2)}%`}
          icon={Percent}
          color="purple"
        />
        <MetricCard
          title="Active Positions"
          value={`${inRangeCount}/${positions?.length || 0}`}
          icon={Activity}
          color="orange"
        />
      </div>

      {/* Positions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Active Positions</h2>
          <Button onClick={() => setShowCreatePosition(true)}>Create Position</Button>
        </div>

        {!positions || positions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg border">
            <p className="text-gray-500 mb-4">No positions found</p>
            <Button onClick={() => setShowCreatePosition(true)}>Create Your First Position</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {positions.map((position) => (
              <PositionCard key={position.position.address} position={position} />
            ))}
          </div>
        )}
      </div>

      <PositionCreator
        open={showCreatePosition}
        onOpenChange={setShowCreatePosition}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
