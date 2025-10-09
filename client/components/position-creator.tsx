import { useState, useEffect } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction, Connection } from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { HelpCircle } from "lucide-react";

interface PositionCreatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

interface Pool {
  address: string;
  tokenX: { symbol: string; mint: string; decimals: number };
  tokenY: { symbol: string; mint: string; decimals: number };
  currentPrice: number;
  binStep: number;
  activeId: number;
}

export function PositionCreator({
  open,
  onOpenChange,
  onSuccess,
}: PositionCreatorProps) {
  const { publicKey, signTransaction } = useWallet();
  const [pools, setPools] = useState<Pool[]>([]);
  const [loadingPools, setLoadingPools] = useState(false);
  const [selectedPool, setSelectedPool] = useState("");
  const [lowerPrice, setLowerPrice] = useState("");
  const [upperPrice, setUpperPrice] = useState("");
  const [amountX, setAmountX] = useState("");
  const [amountY, setAmountY] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const selectedPoolData = pools.find((p) => p.address === selectedPool);

  useEffect(() => {
    if (open) {
      loadPools();
    }
  }, [open]);

  const loadPools = async () => {
    setLoadingPools(true);
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL ||
        "http://localhost:3001/api"}/pools`;
      console.log("[PositionCreator] Fetching pools from:", apiUrl);

      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      console.log("[PositionCreator] Pools response:", result);

      if (result.success && Array.isArray(result.data)) {
        console.log("[PositionCreator] Raw pool data:", result.data);

        // Filter out invalid pools and add safety checks
        const validPools = result.data
          .filter((pool: any) => {
            const hasAddress = !!pool?.address;
            const hasTokenX = !!pool?.tokenX;
            const hasTokenY = !!pool?.tokenY;
            const hasValidPrice =
              typeof pool?.currentPrice === "number" &&
              !isNaN(pool.currentPrice) &&
              pool.currentPrice > 0;

            const isValid =
              hasAddress && hasTokenX && hasTokenY && hasValidPrice;

            if (!isValid) {
              console.warn("[PositionCreator] Invalid pool:", {
                pool,
                hasAddress,
                hasTokenX,
                hasTokenY,
                hasValidPrice,
                currentPrice: pool?.currentPrice,
              });
            }
            return isValid;
          })
          .map((pool: any) => ({
            address: pool.address,
            tokenX: {
              symbol: pool.tokenX.symbol || "Unknown",
              mint: pool.tokenX.mint,
              decimals: pool.tokenX.decimals || 9,
            },
            tokenY: {
              symbol: pool.tokenY.symbol || "Unknown",
              mint: pool.tokenY.mint,
              decimals: pool.tokenY.decimals || 6,
            },
            currentPrice: pool.currentPrice,
            binStep: pool.binStep || 1,
            activeId: pool.activeId || 0,
          }));

        console.log(
          "[PositionCreator] Valid pools:",
          validPools.length,
          "of",
          result.data.length
        );
        setPools(validPools);

        if (validPools.length === 0) {
          toast({
            title: "No pools available",
            description: "No valid pools found. Please try again later.",
            variant: "destructive",
          });
        }
      } else {
        throw new Error("Invalid response format");
      }
    } catch (error) {
      console.error("[PositionCreator] Failed to load pools:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to load pools",
        variant: "destructive",
      });
    } finally {
      setLoadingPools(false);
    }
  };

  const handleCreate = async () => {
    console.log("[PositionCreator] Create button clicked");

    if (!publicKey || !signTransaction) {
      console.warn("[PositionCreator] Wallet not connected");
      toast({
        title: "Wallet not connected",
        description: "Please connect your wallet to create a position",
        variant: "destructive",
      });
      return;
    }

    if (!selectedPool || !lowerPrice || !upperPrice || (!amountX && !amountY)) {
      console.warn("[PositionCreator] Missing required fields", {
        selectedPool,
        lowerPrice,
        upperPrice,
        amountX,
        amountY,
      });
      toast({
        title: "Missing fields",
        description:
          "Please fill in pool, price range, and at least one token amount",
        variant: "destructive",
      });
      return;
    }

    setIsCreating(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || "/api";
      const apiUrl = `${baseUrl}/positions/create`;
      const payload = {
        poolAddress: selectedPool,
        lowerPrice: parseFloat(lowerPrice),
        upperPrice: parseFloat(upperPrice),
        amountX: amountX ? parseFloat(amountX) : 0,
        amountY: amountY ? parseFloat(amountY) : 0,
        wallet: publicKey.toString(),
      };

      console.log("[PositionCreator] Creating position", { apiUrl, payload });

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      console.log("[PositionCreator] Response status:", response.status);
      const result = await response.json();
      console.log("[PositionCreator] Response data:", result);

      if (result.success && result.data) {
        // Deserialize and sign transaction
        const txBuffer = Buffer.from(result.data.transaction, "base64");
        const transaction = Transaction.from(txBuffer);

        console.log("[PositionCreator] Signing transaction...");
        const signedTx = await signTransaction!(transaction);

        // Send signed transaction to Solana network
        console.log("[PositionCreator] Sending transaction to network...");
        const rpcEndpoint =
          import.meta.env.VITE_RPC_ENDPOINT || "https://api.devnet.solana.com";
        const connection = new Connection(rpcEndpoint, "confirmed");

        const signature = await connection.sendRawTransaction(
          signedTx.serialize(),
          {
            skipPreflight: false,
            preflightCommitment: "confirmed",
          }
        );

        console.log("[PositionCreator] Transaction sent", { signature });

        // Wait for confirmation
        toast({
          title: "Transaction sent",
          description: "Waiting for confirmation...",
        });

        const confirmation = await connection.confirmTransaction(
          signature,
          "confirmed"
        );

        if (confirmation.value.err) {
          throw new Error(
            "Transaction failed: " + JSON.stringify(confirmation.value.err)
          );
        }

        console.log("[PositionCreator] Position created successfully", {
          signature,
          positionMint: result.data.positionMint,
        });

        toast({
          title: "Position created!",
          description: `Position created successfully. Signature: ${signature.slice(
            0,
            8
          )}...`,
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        throw new Error(result.error || "Failed to create position");
      }
    } catch (error) {
      console.error("[PositionCreator] Failed to create position:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create position",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Create New Position</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Pool</Label>
              <Select
                value={selectedPool}
                onValueChange={setSelectedPool}
                disabled={loadingPools}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingPools ? "Loading pools..." : "Choose a pool..."
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {pools.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground">
                      No pools available
                    </div>
                  ) : (
                    pools.map((pool) => (
                      <SelectItem key={pool.address} value={pool.address}>
                        {pool.tokenX?.symbol || "Unknown"}/
                        {pool.tokenY?.symbol || "Unknown"}
                        {pool.currentPrice
                          ? `($${pool.currentPrice.toFixed(2)})`
                          : ""}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lower Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={lowerPrice}
                  onChange={(e) => setLowerPrice(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Upper Price</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={upperPrice}
                  onChange={(e) => setUpperPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>
                  {selectedPoolData?.tokenX.symbol || "Token X"} Amount
                </Label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amountX}
                  onChange={(e) => setAmountX(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>
                  {selectedPoolData?.tokenY.symbol || "Token Y"} Amount
                </Label>
                <Input
                  type="number"
                  placeholder="0.0"
                  value={amountY}
                  onChange={(e) => setAmountY(e.target.value)}
                />
              </div>
            </div>

            {selectedPoolData && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowHelp(true)}
                className="w-full"
              >
                <HelpCircle className="w-4 h-4 mr-2" />
                How to Set Price Range?
              </Button>
            )}

            {selectedPoolData && lowerPrice && upperPrice && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <h4 className="font-medium">Position Preview</h4>
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Current Price</span>
                    <span>${selectedPoolData.currentPrice.toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Your Lower Price</span>
                    <span>${parseFloat(lowerPrice).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Your Upper Price</span>
                    <span>${parseFloat(upperPrice).toFixed(4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Range Width</span>
                    <span>
                      {(
                        ((parseFloat(upperPrice) - parseFloat(lowerPrice)) /
                          selectedPoolData.currentPrice) *
                        100
                      ).toFixed(1)}
                      %
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">In Range</span>
                    <span
                      className={
                        selectedPoolData.currentPrice >=
                          parseFloat(lowerPrice) &&
                        selectedPoolData.currentPrice <= parseFloat(upperPrice)
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    >
                      {selectedPoolData.currentPrice >=
                        parseFloat(lowerPrice) &&
                      selectedPoolData.currentPrice <= parseFloat(upperPrice)
                        ? "✓ Yes"
                        : "✗ No (Position will be inactive)"}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isCreating}
              className="flex-1"
            >
              {isCreating ? "Creating..." : "Create Position"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Help Modal */}
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>How to Set Price Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPoolData && (
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <div className="text-sm text-blue-800 space-y-2">
                    <p>
                      <strong>Current Pool Price:</strong> $
                      {selectedPoolData.currentPrice.toFixed(4)}
                    </p>
                    <p>
                      <strong>Recommended Range:</strong> Set your prices close
                      to the current price for maximum efficiency.
                    </p>
                    <div className="bg-white rounded p-3 space-y-1">
                      <p className="font-medium">
                        Example for tight range (±0.5%):
                      </p>
                      <p>
                        • Lower: $
                        {(selectedPoolData.currentPrice * 0.995).toFixed(4)}
                      </p>
                      <p>
                        • Upper: $
                        {(selectedPoolData.currentPrice * 1.005).toFixed(4)}
                      </p>
                    </div>
                    <div className="bg-white rounded p-3 space-y-1">
                      <p className="font-medium">
                        Example for wider range (±1%):
                      </p>
                      <p>
                        • Lower: $
                        {(selectedPoolData.currentPrice * 0.99).toFixed(4)}
                      </p>
                      <p>
                        • Upper: $
                        {(selectedPoolData.currentPrice * 1.01).toFixed(4)}
                      </p>
                    </div>
                    <p className="text-sm">
                      <strong>⚠️ Important:</strong> This pool has binStep{" "}
                      {selectedPoolData.binStep}. Smaller binStep = tighter
                      ranges needed. Max: 140 bins total.
                    </p>
                  </div>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h4 className="font-semibold text-yellow-900 mb-2">
                    Understanding Liquidity Positions
                  </h4>
                  <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                    <li>
                      Your position only earns fees when the price is within
                      your range
                    </li>
                    <li>
                      Tighter ranges = higher capital efficiency but more risk
                      of going out of range
                    </li>
                    <li>Wider ranges = lower efficiency but safer coverage</li>
                    <li>
                      If price moves outside your range, you won't earn fees
                      until it returns
                    </li>
                  </ul>
                </div>
              </>
            )}
            <Button onClick={() => setShowHelp(false)} className="w-full">
              Got it!
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
