import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Transaction } from '@solana/web3.js';
import { useToast } from '@/hooks/use-toast';
import type { PositionData } from '../../shared/schema';

interface PositionCardProps {
  position: PositionData;
  onCollectFees?: () => void;
  onRebalance?: () => void;
  wallet?: string;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export function PositionCard({ position, onCollectFees, onRebalance, wallet }: PositionCardProps) {
  const { pool, currentValue, feesEarned, performance, riskMetrics } = position;
  const isInRange = riskMetrics?.isInRange ?? false;
  const totalReturn = performance?.totalReturn || 0;
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [rebalanceData, setRebalanceData] = useState<any>(null);
  const [isRebalancing, setIsRebalancing] = useState(false);
  const { signTransaction, publicKey } = useWallet();
  const { toast } = useToast();

  const handleRebalance = async () => {
    try {
      if (!wallet || wallet.trim() === '') {
        return;
      }

      setIsRebalancing(true);
      const response = await fetch(`${API_URL}/rebalance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          positionAddress: position.position.address,
          wallet: wallet
        })
      });
      
      const result = await response.json();
      setIsRebalancing(false);
      
      if (result.success && result.data) {
        if (result.data.needsRebalance === false) {
          setRebalanceData({ needsRebalance: false, message: result.data.message });
          setShowRebalanceModal(true);
        } else {
          setRebalanceData(result.data);
          setShowRebalanceModal(true);
        }
      }
    } catch (error) {
      console.error('[PositionCard] Rebalance error:', error);
      setIsRebalancing(false);
    }
  };

  const confirmRebalance = async () => {
    try {
      if (!signTransaction || !publicKey) {
        toast({
          title: 'Wallet not connected',
          description: 'Please connect your wallet to rebalance',
          variant: 'destructive',
        });
        return;
      }

      if (!rebalanceData?.transaction) {
        toast({
          title: 'Transaction not ready',
          description: 'Please try again',
          variant: 'destructive',
        });
        return;
      }

      setIsRebalancing(true);

      // Check if this is a multi-transaction rebalance
      let parsedTx;
      try {
        parsedTx = JSON.parse(rebalanceData.transaction);
      } catch {
        parsedTx = null;
      }

      let signedTransactionData;

      if (parsedTx && parsedTx.type === 'multi' && Array.isArray(parsedTx.transactions)) {
        // Handle multiple transactions
        const signedTxs: string[] = [];
        
        for (const txBase64 of parsedTx.transactions) {
          const txBuffer = Uint8Array.from(atob(txBase64), c => c.charCodeAt(0));
          const transaction = Transaction.from(txBuffer);
          const signedTx = await signTransaction(transaction);
          signedTxs.push(btoa(String.fromCharCode(...signedTx.serialize())));
        }
        
        signedTransactionData = JSON.stringify({
          transactions: signedTxs,
          type: 'multi'
        });
      } else {
        // Handle single transaction (legacy)
        const txBuffer = Uint8Array.from(atob(rebalanceData.transaction), c => c.charCodeAt(0));
        const transaction = Transaction.from(txBuffer);
        const signedTx = await signTransaction(transaction);
        signedTransactionData = btoa(String.fromCharCode(...signedTx.serialize()));
      }

      // Send the transaction(s)
      const response = await fetch(`${API_URL}/rebalance/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signedTransaction: signedTransactionData,
          positionAddress: position.position.address,
          newPositionMint: rebalanceData.newPositionMint,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Rebalance successful',
          description: `Position rebalanced successfully`,
        });
        setShowRebalanceModal(false);
        if (onRebalance) onRebalance();
      } else {
        throw new Error(result.error || 'Rebalance failed');
      }
    } catch (error) {
      console.error('[PositionCard] Rebalance execution error:', error);
      toast({
        title: 'Rebalance failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsRebalancing(false);
    }
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl font-semibold">
              {pool?.tokenX?.symbol || 'Unknown'}/{pool?.tokenY?.symbol || 'Unknown'}
            </CardTitle>
            <p className="text-xs text-muted-foreground font-mono">
              {position.position?.address?.slice(0, 8)}...{position.position?.address?.slice(-6)}
            </p>
          </div>
          <Badge 
            variant={isInRange ? 'default' : 'destructive'}
            className="font-medium"
          >
            {isInRange ? '● In Range' : '● Out of Range'}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Value Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Position Value</p>
            <p className="text-lg font-semibold">${(currentValue || 0).toFixed(2)}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Fees Earned</p>
            <p className="text-lg font-semibold text-success">
              ${(feesEarned?.total || 0).toFixed(2)}
            </p>
          </div>
        </div>

        {/* Performance */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Total Return</span>
            <span className={`text-sm font-medium flex items-center gap-1 ${
              totalReturn >= 0 ? 'text-success' : 'text-destructive'
            }`}>
              {totalReturn >= 0 ? (
                <ArrowUpRight className="h-3 w-3" />
              ) : (
                <ArrowDownRight className="h-3 w-3" />
              )}
              {totalReturn >= 0 ? '+' : ''}{totalReturn.toFixed(2)}%
            </span>
          </div>
          <Progress 
            value={Math.min(Math.abs(totalReturn), 100)} 
            className="h-1.5"
          />
        </div>

        {/* Risk Metrics */}
        {!isInRange && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="space-y-1 flex-1">
              <p className="text-xs font-medium text-warning">Position Out of Range</p>
              <p className="text-xs text-muted-foreground">
                Consider rebalancing to optimize fee earnings
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            onClick={handleRebalance}
            variant={isInRange ? "outline" : "default"}
            className="flex-1 gap-2"
            size="sm"
            disabled={isRebalancing}
          >
            <RefreshCw className={`h-4 w-4 ${isRebalancing ? 'animate-spin' : ''}`} />
            {isRebalancing ? 'Checking...' : 'Rebalance'}
          </Button>
          {onCollectFees && (
            <Button
              onClick={onCollectFees}
              variant="outline"
              className="flex-1 gap-2"
              size="sm"
            >
              <DollarSign className="h-4 w-4" />
              Collect Fees
            </Button>
          )}
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t text-xs">
          <div className="space-y-1">
            <p className="text-muted-foreground">Daily Yield</p>
            <p className="font-medium">{((performance?.dailyYield || 0) * 100).toFixed(3)}%</p>
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground">APY</p>
            <p className="font-medium">{((performance?.dailyYield || 0) * 365 * 100).toFixed(2)}%</p>
          </div>
        </div>
      </CardContent>

      {/* Rebalance Modal */}
      <Dialog open={showRebalanceModal} onOpenChange={setShowRebalanceModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rebalance Position</DialogTitle>
            <DialogDescription>
              {rebalanceData?.needsRebalance === false ? (
                rebalanceData.message || 'Position does not need rebalancing'
              ) : (
                `Review the proposed rebalance for ${pool?.tokenX?.symbol}/${pool?.tokenY?.symbol}`
              )}
            </DialogDescription>
          </DialogHeader>

          {rebalanceData?.needsRebalance !== false && rebalanceData && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current Range</span>
                  <span className="font-mono font-medium">
                    {rebalanceData.currentRange?.lowerBinId} - {rebalanceData.currentRange?.upperBinId}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">New Range</span>
                  <span className="font-mono font-medium text-primary">
                    {rebalanceData.newRange?.lowerBinId} - {rebalanceData.newRange?.upperBinId}
                  </span>
                </div>
              </div>

              <div className="rounded-lg bg-secondary/50 p-3 space-y-2">
                <p className="text-sm font-medium">This will:</p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Remove liquidity from current position</li>
                  <li>Add liquidity to new optimized range</li>
                </ol>
              </div>

              <div className="rounded-lg bg-muted p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium">Note:</span> This will remove liquidity from your current position and create a new position with the optimized range.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowRebalanceModal(false)}
              className="w-full sm:w-auto"
              disabled={isRebalancing}
            >
              Cancel
            </Button>
            {rebalanceData?.needsRebalance !== false && (
              <Button
                onClick={confirmRebalance}
                className="w-full sm:w-auto"
                disabled={isRebalancing}
              >
                {isRebalancing ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Rebalance'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
