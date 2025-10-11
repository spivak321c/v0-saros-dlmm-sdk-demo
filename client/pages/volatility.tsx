import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  TrendingUp,
  TrendingDown,
  Activity,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useVolatility } from "@/lib/volatility-context";
import { PoolDetailModal } from "@/components/pool-detail-modal";

interface VolatilityData {
  poolAddress: string;
  volatility: number;
  priceChange24h: number;
  timestamp: number;
  tokenX?: { symbol: string };
  tokenY?: { symbol: string };
}

export default function Volatility() {
  const {
    pools,
    volatilityData,
    setPools,
    updateVolatilityForPool,
  } = useVolatility();
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingPools, setLoadingPools] = useState(false);
  const [selectedPool, setSelectedPool] = useState<any>(null);
  const [showPoolDetail, setShowPoolDetail] = useState(false);
  const [loadingVolatility, setLoadingVolatility] = useState<Set<string>>(
    new Set()
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12);

  useEffect(() => {
    if (pools.length === 0) {
      loadPools();
    }
  }, []);

  const loadPools = async (page: number = 1, limit: number = 50) => {
    setLoadingPools(true);
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL ||
        "http://localhost:3001/api"}/pools?page=${page}&limit=${limit}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && Array.isArray(result.data)) {
        // Merge with existing pools to avoid duplicates
        setPools((prevPools) => {
          const poolMap = new Map(prevPools.map((p) => [p.address, p]));
          result.data.forEach((pool: any) => poolMap.set(pool.address, pool));
          return Array.from(poolMap.values());
        });

        // Auto-load volatility for first 5 pools if this is the first load
        if (page === 1) {
          result.data.slice(0, 5).forEach((pool: any) => {
            loadVolatilityForPool(pool.address);
          });
        }
      }
    } catch (error) {
      console.error("Failed to load pools:", error);
      toast({
        title: "Error",
        description: "Failed to load pools",
        variant: "destructive",
      });
    } finally {
      setLoadingPools(false);
    }
  };

  const loadVolatilityForPool = async (poolAddress: string) => {
    setLoadingVolatility((prev) => new Set(prev).add(poolAddress));

    try {
      const apiUrl = `${import.meta.env.VITE_API_URL ||
        "http://localhost:3001/api"}/volatility/${poolAddress}`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.success && result.data) {
        updateVolatilityForPool(poolAddress, {
          ...result.data,
          poolAddress,
        });
      }
    } catch (error) {
      console.error("Failed to load volatility:", error);
      toast({
        title: "Error",
        description: `Failed to load volatility for pool`,
        variant: "destructive",
      });
    } finally {
      setLoadingVolatility((prev) => {
        const newSet = new Set(prev);
        newSet.delete(poolAddress);
        return newSet;
      });
    }
  };

  const filteredPools = pools.filter((pool) => {
    const matchesSearch =
      pool.tokenX?.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.tokenY?.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.address?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  // Pagination
  const totalPages = Math.ceil(filteredPools.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPools = filteredPools.slice(startIndex, endIndex);

  // Reset to page 1 when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const getVolatilityColor = (volatility: number) => {
    if (volatility < 20) return "text-green-600";
    if (volatility < 50) return "text-yellow-600";
    return "text-red-600";
  };

  const getVolatilityBadge = (volatility: number) => {
    if (volatility < 20) return { label: "Low", variant: "default" as const };
    if (volatility < 50)
      return { label: "Medium", variant: "secondary" as const };
    return { label: "High", variant: "destructive" as const };
  };

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            Pool Volatility Tracker
          </h1>
          <p className="text-muted-foreground mt-1">
            Monitor real-time volatility metrics for DLMM pools
          </p>
        </div>
        <Button
          onClick={() => loadPools()}
          disabled={loadingPools}
          className="gap-2"
        >
          <RefreshCw
            className={`w-4 h-4 ${loadingPools ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Info Alert */}
      <Alert>
        <Activity className="h-4 w-4" />
        <AlertDescription>
          Volatility is calculated based on price movements and helps determine
          optimal rebalancing strategies. Lower volatility = tighter ranges,
          Higher volatility = wider ranges recommended.
        </AlertDescription>
      </Alert>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Search by token pair or pool address..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Pools Grid */}
      {loadingPools ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading pools...</p>
          </div>
        </div>
      ) : paginatedPools.length === 0 ? (
        <Card>
          <CardContent className="py-20 text-center">
            <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No pools found</h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? "Try adjusting your search criteria"
                : "No pools available"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedPools.map((pool) => {
              const volatility = volatilityData.get(pool.address);
              const isLoading = loadingVolatility.has(pool.address);
              const badge = volatility
                ? getVolatilityBadge(volatility.volatility)
                : null;

              return (
                <Card
                  key={pool.address}
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => {
                    const volatility = volatilityData.get(pool.address);
                    setSelectedPool(pool);
                    setShowPoolDetail(true);
                  }}
                >
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {pool.tokenX.symbol}/{pool.tokenY.symbol}
                        </CardTitle>
                        <CardDescription className="text-xs mt-1">
                          {pool.address.slice(0, 8)}...{pool.address.slice(-8)}
                        </CardDescription>
                      </div>
                      {badge && (
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">
                          Current Price
                        </span>
                        <span className="font-medium">
                          ${(pool.currentPrice || 0).toFixed(4)}
                        </span>
                      </div>

                      {volatility ? (
                        <>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Volatility
                            </span>
                            <span
                              className={`font-bold ${getVolatilityColor(
                                volatility.volatility
                              )}`}
                            >
                              {volatility.volatility.toFixed(2)}%
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              24h Change
                            </span>
                            <div className="flex items-center gap-1">
                              {volatility.priceChange24h >= 0 ? (
                                <TrendingUp className="w-4 h-4 text-green-600" />
                              ) : (
                                <TrendingDown className="w-4 h-4 text-red-600" />
                              )}
                              <span
                                className={
                                  volatility.priceChange24h >= 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }
                              >
                                {volatility.priceChange24h >= 0 ? "+" : ""}
                                {volatility.priceChange24h.toFixed(2)}%
                              </span>
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-sm text-muted-foreground">
                              Last Updated
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(
                                volatility.timestamp
                              ).toLocaleTimeString()}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="py-4 text-center">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              loadVolatilityForPool(pool.address);
                            }}
                            disabled={isLoading}
                            className="w-full"
                          >
                            {isLoading ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                Loading...
                              </>
                            ) : (
                              <>
                                <Activity className="w-4 h-4 mr-2" />
                                Load Volatility
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>

                    {volatility && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          loadVolatilityForPool(pool.address);
                        }}
                        disabled={isLoading}
                        className="w-full"
                      >
                        <RefreshCw
                          className={`w-4 h-4 mr-2 ${
                            isLoading ? "animate-spin" : ""
                          }`}
                        />
                        Refresh
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Card className="mt-6">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    Showing {startIndex + 1}-
                    {Math.min(endIndex, filteredPools.length)} of{" "}
                    {filteredPools.length} pools
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((page) => {
                          // Show first, last, current, and adjacent pages
                          return (
                            page === 1 ||
                            page === totalPages ||
                            Math.abs(page - currentPage) <= 1
                          );
                        })
                        .map((page, idx, arr) => {
                          // Add ellipsis
                          const prevPage = arr[idx - 1];
                          const showEllipsis = prevPage && page - prevPage > 1;

                          return (
                            <div key={page} className="flex items-center">
                              {showEllipsis && (
                                <span className="px-2 text-muted-foreground">
                                  ...
                                </span>
                              )}
                              <Button
                                variant={
                                  currentPage === page ? "default" : "outline"
                                }
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                                className="min-w-[2.5rem]"
                              >
                                {page}
                              </Button>
                            </div>
                          );
                        })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Pool Detail Modal */}
      <PoolDetailModal
        pool={selectedPool}
        open={showPoolDetail}
        onOpenChange={setShowPoolDetail}
        volatilityData={
          selectedPool && volatilityData.get(selectedPool.address)
            ? {
                volatility: volatilityData.get(selectedPool.address)!
                  .volatility,
                priceChange24h: volatilityData.get(selectedPool.address)!
                  .priceChange24h,
                volumeChange24h: 0,
                lastUpdate: volatilityData.get(selectedPool.address)!.timestamp,
              }
            : undefined
        }
      />
    </div>
  );
}
