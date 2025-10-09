import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletPositions } from '../hooks/use-wallet-positions';
import { PositionCard } from '../components/position-card';
import { PositionCreator } from '../components/position-creator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

export default function Positions() {
  const { publicKey } = useWallet();
  const { data: positions, isLoading, refetch } = useWalletPositions();
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreatePosition, setShowCreatePosition] = useState(false);

  console.log('[Positions] Render state:', { 
    publicKey: publicKey?.toString(), 
    positionsCount: positions?.length, 
    isLoading,
    searchQuery 
  });

  const filteredPositions = positions?.filter((pos) =>
    pos.pool.tokenX.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pos.pool.tokenY.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pos.position.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  console.log('[Positions] Filtered positions:', { 
    total: positions?.length, 
    filtered: filteredPositions?.length 
  });

  if (!publicKey) {
    console.log('[Positions] No wallet connected');
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600">Connect wallet to view positions</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">All Positions</h1>
          <p className="text-gray-600">
            {positions?.length || 0} position{positions?.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setShowCreatePosition(true)}>Create Position</Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search positions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Positions Grid */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading positions...</p>
        </div>
      ) : !filteredPositions || filteredPositions.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border">
          <p className="text-gray-500">No positions found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPositions.map((position) => (
            <PositionCard key={position.position.address} position={position} />
          ))}
        </div>
      )}

      <PositionCreator
        open={showCreatePosition}
        onOpenChange={setShowCreatePosition}
        onSuccess={() => refetch()}
      />
    </div>
  );
}
