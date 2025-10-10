import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Activity,
  TrendingUp,
  Wallet,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { useWalletPositions } from "../hooks/use-wallet-positions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { useWebSocket } from "@/lib/websocket";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const { data: positions, isLoading } = useWalletPositions();
  const { lastMessage } = useWebSocket();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    totalValue: 0,
    totalFees: 0,
    activePositions: 0,
    avgAPY: 0,
  });
  const [autoRebalanceStatus, setAutoRebalanceStatus] = useState<{
    enabled: boolean;
    threshold: number;
    lastCheck?: number;
  } | null>(null);

  useEffect(() => {
    if (positions && positions.length > 0) {
      const totalValue = positions.reduce(
        (sum, p) => sum + (p.currentValue || 0),
        0
      );
      const totalFees = positions.reduce(
        (sum, p) => sum + (p.feesEarned?.total || 0),
        0
      );
      const avgYield =
        positions.reduce(
          (sum, p) => sum + (p.performance?.dailyYield || 0),
          0
        ) / positions.length;

      setStats({
        totalValue,
        totalFees,
        activePositions: positions.length,
        avgAPY: avgYield * 365,
      });
    }
  }, [positions]);

  // Listen for WebSocket updates
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "auto_rebalance_status") {
      setAutoRebalanceStatus(lastMessage.data);
    } else if (lastMessage.type === "alert") {
      const alert = lastMessage.data;
      toast({
        title: alert.title,
        description: alert.message,
        variant: alert.type === "error" ? "destructive" : "default",
      });
    } else if (lastMessage.type === "rebalance_event") {
      const event = lastMessage.data;
      toast({
        title: "Rebalance Completed",
        description: `Position ${event.positionAddress.slice(
          0,
          8
        )}... has been rebalanced`,
      });
    }
  }, [lastMessage, toast]);

  if (!publicKey) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="pt-6 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect your Solana wallet to view your DLMM positions and
              portfolio analytics
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your portfolio...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-1 sm:space-y-2">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
          Portfolio Overview
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Monitor and manage your Saros DLMM liquidity positions
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Total Value
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              ${stats.totalValue.toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Across {stats.activePositions} position
              {stats.activePositions !== 1 ? "s" : ""}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Fees Earned
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              ${stats.totalFees.toFixed(2)}
            </div>
            <p className="text-xs text-success mt-1 flex items-center gap-1">
              <ArrowUpRight className="h-3 w-3" />
              From trading fees
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Active Positions
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {stats.activePositions}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {positions?.filter((p) => p.riskMetrics?.isInRange).length || 0}{" "}
              in range
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Avg APY
            </CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">
              {stats.avgAPY.toFixed(2)}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Annualized yield
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Positions */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-lg sm:text-xl">
              Recent Positions
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/positions")}
              className="self-start sm:self-auto"
            >
              View All
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {positions && positions.length > 0 ? (
            <div className="space-y-3">
              {positions.slice(0, 5).map((position, idx) => (
                <div
                  key={idx}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors cursor-pointer"
                  onClick={() => navigate("/positions")}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                        {position.pool?.tokenX?.symbol?.charAt(0) || "?"}
                      </div>
                      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium -ml-2">
                        {position.pool?.tokenY?.symbol?.charAt(0) || "?"}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm sm:text-base font-medium">
                        {position.pool?.tokenX?.symbol || "Unknown"}/
                        {position.pool?.tokenY?.symbol || "Unknown"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {position.riskMetrics?.isInRange ? (
                          <span className="text-success">● In Range</span>
                        ) : (
                          <span className="text-warning">● Out of Range</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-sm sm:text-base font-medium">
                      ${(position.currentValue || 0).toFixed(2)}
                    </p>
                    <p
                      className={`text-xs flex items-center gap-1 sm:justify-end ${
                        (position.performance?.totalReturn || 0) >= 0
                          ? "text-success"
                          : "text-destructive"
                      }`}
                    >
                      {(position.performance?.totalReturn || 0) >= 0 ? (
                        <ArrowUpRight className="h-3 w-3" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3" />
                      )}
                      {Math.abs(position.performance?.totalReturn || 0).toFixed(
                        2
                      )}
                      %
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">No positions yet</p>
              <Button onClick={() => navigate("/positions")}>
                Create Your First Position
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        <Button
          onClick={() => navigate("/positions")}
          className="h-auto py-5 sm:py-6 flex-col gap-2"
          variant="outline"
        >
          <Activity className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-sm sm:text-base font-medium">
            Manage Positions
          </span>
        </Button>
        <Button
          onClick={() => navigate("/simulator")}
          className="h-auto py-5 sm:py-6 flex-col gap-2"
          variant="outline"
        >
          <Zap className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-sm sm:text-base font-medium">
            Strategy Simulator
          </span>
        </Button>
        <Button
          onClick={() => navigate("/analytics")}
          className="h-auto py-5 sm:py-6 flex-col gap-2 sm:col-span-2 lg:col-span-1"
          variant="outline"
        >
          <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
          <span className="text-sm sm:text-base font-medium">
            View Analytics
          </span>
        </Button>
      </div>
    </div>
  );
}
