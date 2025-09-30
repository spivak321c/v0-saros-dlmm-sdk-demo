"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  TrendingUp,
  TrendingDown,
  Search,
  Plus,
  ExternalLink,
} from "lucide-react";

interface Pool {
  address: string;
  tokenX: string;
  tokenY: string;
  tvl: number;
  volume24h: number;
  apy: number;
  fees24h: number;
  binStep: number;
  activeId: number;
  priceChange24h: number;
}

export default function PoolsPage() {
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/pools")
      .then((res) => res.json())
      .then((data) => {
        setPools(data.pools);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to fetch pools:", error);
        setLoading(false);
      });
  }, []);

  const filteredPools = pools.filter(
    (pool) =>
      pool.tokenX.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pool.tokenY.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number) => {
    return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading pools...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 sm:py-8 lg:px-8">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2 text-balance">
            DLMM Pools
          </h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Browse and manage liquidity positions across Saros DLMM pools
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search pools by token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button className="sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Liquidity
          </Button>
        </div>

        {/* Pools Grid */}
        <div className="grid gap-4 sm:gap-6 grid-cols-1 lg:grid-cols-2">
          {filteredPools.map((pool) => (
            <Card
              key={pool.address}
              className="hover:shadow-lg transition-shadow"
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-xl sm:text-2xl mb-1">
                      {pool.tokenX}/{pool.tokenY}
                    </CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Bin Step: {pool.binStep} • Active ID: {pool.activeId}
                    </CardDescription>
                  </div>
                  <Badge
                    variant={
                      pool.priceChange24h >= 0 ? "default" : "destructive"
                    }
                    className="flex items-center gap-1"
                  >
                    {pool.priceChange24h >= 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {formatPercent(pool.priceChange24h)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      TVL
                    </p>
                    <p className="text-base sm:text-lg font-semibold">
                      {formatCurrency(pool.tvl)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      24h Volume
                    </p>
                    <p className="text-base sm:text-lg font-semibold">
                      {formatCurrency(pool.volume24h)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      APY
                    </p>
                    <p className="text-base sm:text-lg font-semibold text-primary">
                      {pool.apy.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground mb-1">
                      24h Fees
                    </p>
                    <p className="text-base sm:text-lg font-semibold">
                      {formatCurrency(pool.fees24h)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="default" className="flex-1" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Liquidity
                  </Button>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPools.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              No pools found matching your search.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
