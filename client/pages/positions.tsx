import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletPositions } from "../hooks/use-wallet-positions";
import { PositionCard } from "../components/position-card";
import { PositionCreator } from "../components/position-creator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Plus, Wallet, Filter } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Positions() {
  const { publicKey } = useWallet();
  const { data: positions, isLoading, refetch } = useWalletPositions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreatePosition, setShowCreatePosition] = useState(false);

  const filteredPositions = positions?.filter((pos) => {
    const matchesSearch =
      pos.pool?.tokenX?.symbol
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      pos.pool?.tokenY?.symbol
        ?.toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      pos.position?.address?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "in-range" && pos.riskMetrics?.isInRange) ||
      (statusFilter === "out-of-range" && !pos.riskMetrics?.isInRange);

    return matchesSearch && matchesStatus;
  });

  if (!publicKey) {
    return (
      <div className="flex items-center justify-center min-h-[80vh] p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-xl font-semibold mb-2">Connect Your Wallet</h2>
            <p className="text-muted-foreground">
              Connect your Solana wallet to view and manage your positions
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Positions
          </h1>
          <p className="text-muted-foreground mt-1">
            {positions?.length || 0} active position
            {positions?.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowCreatePosition(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Position
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by token pair or address..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="relative w-full sm:w-48">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="pl-10">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  <SelectItem value="in-range">In Range</SelectItem>
                  <SelectItem value="out-of-range">Out of Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Positions Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading positions...</p>
          </div>
        </div>
      ) : !filteredPositions || filteredPositions.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <div className="max-w-md mx-auto">
              {searchQuery || statusFilter !== "all" ? (
                <>
                  <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">
                    No positions found
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Try adjusting your search or filter criteria
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSearchQuery("");
                      setStatusFilter("all");
                    }}
                  >
                    Clear Filters
                  </Button>
                </>
              ) : (
                <>
                  <Plus className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <h3 className="text-lg font-semibold mb-2">
                    No positions yet
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create your first DLMM position to start earning fees
                  </p>
                  <Button onClick={() => setShowCreatePosition(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Position
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredPositions.map((position) => (
            <PositionCard
              key={position.position?.address || Math.random()}
              position={position}
              wallet={publicKey.toString()}
              onRebalance={() => refetch()}
            />
          ))}
        </div>
      )}

      {/* Position Creator Modal */}
      <PositionCreator
        open={showCreatePosition}
        onOpenChange={setShowCreatePosition}
        onSuccess={() => {
          setShowCreatePosition(false);
          refetch();
        }}
      />
    </div>
  );
}
