"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, ExternalLink } from "lucide-react";

interface Position {
  positionId: string;
  poolAddress: string;
  tokenX: string;
  tokenY: string;
  lowerBin: number;
  upperBin: number;
  currentBin: number;
  liquidityX: number;
  liquidityY: number;
  feesEarnedX: number;
  feesEarnedY: number;
  isInRange: boolean;
  valueUSD: number;
  apy: number;
}

interface PositionListProps {
  positions: Position[];
}

export function PositionList({ positions }: PositionListProps) {
  if (positions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">
            Active Positions
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Your DLMM liquidity positions across all pools
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <p className="text-sm sm:text-base text-muted-foreground">
              No active positions found
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Add liquidity to DLMM pools to get started
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Active Positions</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Your DLMM liquidity positions across all pools
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {positions.map((position) => (
            <div
              key={position.positionId}
              className="flex flex-col sm:flex-row items-start justify-between rounded-lg border p-3 sm:p-4 hover:bg-accent/50 transition-colors gap-4"
            >
              <div className="space-y-3 flex-1 w-full">
                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                  <h3 className="font-semibold text-base sm:text-lg">
                    {position.tokenX}/{position.tokenY}
                  </h3>
                  {position.isInRange ? (
                    <Badge
                      variant="default"
                      className="bg-green-600 hover:bg-green-600 text-xs"
                    >
                      <CheckCircle2 className="mr-1 h-3 w-3" />
                      In Range
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Out of Range
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 text-xs sm:text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Position Value</p>
                    <p className="font-semibold">
                      ${position.valueUSD.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">APY</p>
                    <p className="font-semibold text-green-600 dark:text-green-500">
                      {position.apy.toFixed(2)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Range</p>
                    <p className="font-semibold">
                      {position.lowerBin} - {position.upperBin}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Current Bin</p>
                    <p className="font-semibold">{position.currentBin}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm pt-2 border-t">
                  <div>
                    <p className="text-muted-foreground mb-1">Liquidity</p>
                    <p className="font-mono text-xs">
                      {(position.liquidityX / 1e9).toFixed(4)} {position.tokenX}
                    </p>
                    <p className="font-mono text-xs">
                      {(position.liquidityY / 1e9).toFixed(2)} {position.tokenY}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Fees Earned</p>
                    <p className="font-mono text-xs text-green-600 dark:text-green-500">
                      {(position.feesEarnedX / 1e9).toFixed(6)}{" "}
                      {position.tokenX}
                    </p>
                    <p className="font-mono text-xs text-green-600 dark:text-green-500">
                      {(position.feesEarnedY / 1e9).toFixed(4)}{" "}
                      {position.tokenY}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex sm:flex-col gap-2 w-full sm:w-auto sm:ml-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 sm:flex-none bg-transparent"
                >
                  Manage
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex-1 sm:flex-none"
                  asChild
                >
                  <a
                    href={`https://explorer.solana.com/address/${position.poolAddress}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
