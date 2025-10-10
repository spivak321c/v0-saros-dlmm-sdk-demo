import { Connection, PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { getConnection } from "./connection";
import type { PoolInfo, Position } from "../../shared/schema";
import { LiquidityBookServices, MODE } from "@saros-finance/dlmm-sdk";
import { logger } from "../utils/logger";
import { getMint } from "@solana/spl-token";

export class DLMMClient {
  private connection: Connection;
  private sarosDLMM: LiquidityBookServices;

  constructor() {
    this.connection = getConnection();
    logger.info("Initializing DLMM client", {
      mode: "DEVNET",
      rpcUrl: this.connection.rpcEndpoint,
    });
    this.sarosDLMM = new LiquidityBookServices({
      mode: MODE.DEVNET,
      options: {
        rpcUrl: this.connection.rpcEndpoint,
      },
    });
    logger.info("DLMM client initialized successfully");
  }

  async getTokenSymbol(mintAddress: string): Promise<string> {
    try {
      const mint = new PublicKey(mintAddress);

      // Try to get token metadata from Metaplex
      try {
        const TOKEN_METADATA_PROGRAM_ID = new PublicKey(
          "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
        );
        const metadataPDA = PublicKey.findProgramAddressSync(
          [
            Buffer.from("metadata"),
            TOKEN_METADATA_PROGRAM_ID.toBuffer(),
            mint.toBuffer(),
          ],
          TOKEN_METADATA_PROGRAM_ID
        )[0];

        const accountInfo = await this.connection.getAccountInfo(metadataPDA);
        if (accountInfo && accountInfo.data.length > 0) {
          // Parse metadata manually - simple extraction of symbol
          const data = accountInfo.data;
          // Metadata layout: key (1) + update_authority (32) + mint (32) + name (4 + len) + symbol (4 + len) + ...
          let offset = 1 + 32 + 32; // Skip key, update_authority, mint

          // Skip name
          const nameLen = data.readUInt32LE(offset);
          offset += 4 + nameLen;

          // Read symbol
          const symbolLen = data.readUInt32LE(offset);
          offset += 4;
          const symbol = data
            .slice(offset, offset + symbolLen)
            .toString("utf8")
            .replace(/\0/g, "")
            .trim();

          if (symbol) {
            return symbol;
          }
        }
      } catch (e) {
        // Metadata not found or parsing failed
      }

      // Fallback: use shortened mint address
      return mintAddress.slice(0, 4) + "..." + mintAddress.slice(-4);
    } catch (error) {
      logger.warn("Failed to fetch token symbol", {
        mint: mintAddress,
        error: error instanceof Error ? error.message : String(error),
      });
      return "Unknown";
    }
  }

  async getPoolInfo(poolAddress: PublicKey): Promise<PoolInfo> {
    try {
      logger.debug("Fetching pool info", {
        poolAddress: poolAddress.toString(),
      });
      // Fetch pool metadata using the SDK
      const metadata = await this.sarosDLMM.fetchPoolMetadata(
        poolAddress.toString()
      );

      if (!metadata) {
        throw new Error("Pool not found");
      }

      // Get pair account for detailed state
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);

      // Calculate current price from active bin
      const activeBinId = pairAccount.activeId;
      const currentPrice = this.binIdToPrice(activeBinId, pairAccount.binStep);

      // Fetch token symbols
      const [tokenXSymbol, tokenYSymbol] = await Promise.all([
        this.getTokenSymbol(metadata.baseMint),
        this.getTokenSymbol(metadata.quoteMint),
      ]);

      const poolInfo = {
        address: poolAddress.toString(),
        tokenX: {
          mint: metadata.baseMint,
          symbol: tokenXSymbol,
          decimals: metadata.extra.tokenBaseDecimal,
        },
        tokenY: {
          mint: metadata.quoteMint,
          symbol: tokenYSymbol,
          decimals: metadata.extra.tokenQuoteDecimal,
        },
        binStep: pairAccount.binStep,
        activeId: pairAccount.activeId,
        currentPrice,
        tvl: 0,
        volume24h: 0,
        fees24h: 0,
      };
      logger.debug("Pool info fetched successfully", {
        poolAddress: poolAddress.toString(),
        activeId: pairAccount.activeId,
        tokenX: tokenXSymbol,
        tokenY: tokenYSymbol,
        currentPrice,
      });
      return poolInfo;
    } catch (error) {
      logger.error("Failed to fetch pool info", {
        poolAddress: poolAddress.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async getUserPositions(
    walletAddress: PublicKey,
    specificPool?: PublicKey
  ): Promise<Position[]> {
    try {
      logger.debug("Fetching user positions", {
        wallet: walletAddress.toString(),
        specificPool: specificPool?.toString(),
      });

      // If a specific pool is provided, only check that pool
      let poolsToCheck: string[];

      if (specificPool) {
        poolsToCheck = [specificPool.toString()];
        logger.debug("Checking specific pool for positions", {
          pool: specificPool.toString(),
        });
      } else {
        // According to Saros DLMM SDK docs, we need to query positions by pool
        // Get all pool addresses
        const poolAddresses = await this.sarosDLMM.fetchPoolAddresses();
        logger.debug("Total pools available", { count: poolAddresses.length });

        // Limit pools to avoid rate limits and timeouts
        poolsToCheck = poolAddresses.slice(0, 30);
        logger.debug("Checking pools for user positions", {
          wallet: walletAddress.toString(),
          poolCount: poolsToCheck.length,
        });
      }

      const allPositions: Position[] = [];
      let checkedPools = 0;
      let poolsWithPositions = 0;

      // Query pools sequentially with delay to avoid rate limits
      for (const poolAddr of poolsToCheck) {
        try {
          checkedPools++;

          // Use getUserPositions from SDK - it requires both payer and pair
          const positions = await this.sarosDLMM.getUserPositions({
            payer: walletAddress,
            pair: new PublicKey(poolAddr),
          });

          logger.debug("Checked pool for positions", {
            poolAddress: poolAddr,
            positionsFound: positions?.length || 0,
            positionsType: typeof positions,
            positionsIsArray: Array.isArray(positions),
          });

          if (positions && positions.length > 0) {
            poolsWithPositions++;
            logger.info("Found positions in pool - full structure", {
              poolAddress: poolAddr,
              count: positions.length,
              firstPositionKeys: Object.keys(positions[0]),
              firstPositionFull: JSON.stringify(positions[0], null, 2),
            });

            for (const position of positions) {
              // Log the actual position object to understand its structure
              logger.debug("Raw position object", {
                position: JSON.stringify(position, null, 2),
                keys: Object.keys(position),
              });

              // Extract position data from SDK response
              const posData = {
                address: position.position?.toString() || "",
                poolAddress: poolAddr,
                owner: walletAddress.toString(),
                lowerBinId: position.lowerBinId || 0,
                upperBinId: position.upperBinId || 0,
                liquidityX:
                  position.totalXAmount?.toString() ||
                  position.liquidityX?.toString() ||
                  "0",
                liquidityY:
                  position.totalYAmount?.toString() ||
                  position.liquidityY?.toString() ||
                  "0",
                feeX: position.feeX?.toString() || "0",
                feeY: position.feeY?.toString() || "0",
                rewardOne: position.rewardOne?.toString() || "0",
                rewardTwo: position.rewardTwo?.toString() || "0",
                lastUpdatedAt: position.lastUpdatedAt || Date.now(),
                createdAt: position.lastUpdatedAt || Date.now(),
              };

              logger.debug("Parsed position data", { posData });
              allPositions.push(posData);
            }
          }

          // Add delay between requests to avoid rate limits (429 errors)
          await this.delay(300);
        } catch (err) {
          // Skip pools where user has no positions or errors occur
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (
            !errorMsg.includes("429") &&
            !errorMsg.includes("Account does not exist")
          ) {
            logger.debug("Error checking pool for positions", {
              poolAddress: poolAddr,
              error: errorMsg,
            });
          }
          continue;
        }
      }

      logger.info("User positions fetched", {
        wallet: walletAddress.toString(),
        totalPositions: allPositions.length,
        poolsChecked: checkedPools,
        poolsWithPositions,
      });

      return allPositions;
    } catch (error) {
      logger.error("Failed to fetch user positions", {
        wallet: walletAddress.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async getPositionInfo(positionAddress: PublicKey): Promise<Position | null> {
    try {
      logger.debug("Fetching position info", {
        positionAddress: positionAddress.toString(),
      });
      const positionAccount =
        await this.sarosDLMM.getPositionAccount(positionAddress);

      if (!positionAccount) return null;

      // Log the actual structure to understand what we're getting
      logger.debug("Position account structure", {
        positionAddress: positionAddress.toString(),
        keys: Object.keys(positionAccount),
        fullObject: JSON.stringify(positionAccount, null, 2),
      });

      const position = {
        address: positionAddress.toString(),
        poolAddress:
          positionAccount.lbPair?.toString() ||
          positionAccount.pair?.toString() ||
          "",
        owner: positionAccount.owner?.toString() || "",
        lowerBinId: positionAccount.lowerBinId || 0,
        upperBinId: positionAccount.upperBinId || 0,
        liquidityX: positionAccount.totalXAmount?.toString() || "0",
        liquidityY: positionAccount.totalYAmount?.toString() || "0",
        feeX: positionAccount.feeX?.toString() || "0",
        feeY: positionAccount.feeY?.toString() || "0",
        rewardOne: positionAccount.rewardOne?.toString() || "0",
        rewardTwo: positionAccount.rewardTwo?.toString() || "0",
        lastUpdatedAt: positionAccount.lastUpdatedAt || Date.now(),
        createdAt: positionAccount.lastUpdatedAt || Date.now(),
      };
      logger.debug("Position info fetched", {
        positionAddress: positionAddress.toString(),
        poolAddress: position.poolAddress,
      });
      return position;
    } catch (error) {
      logger.error("Failed to fetch position info", {
        positionAddress: positionAddress.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  async getPoolAddresses(): Promise<string[]> {
    try {
      logger.debug("Fetching pool addresses");
      const addresses = await this.sarosDLMM.fetchPoolAddresses();
      logger.info("Pool addresses fetched", { count: addresses.length });
      return addresses;
    } catch (error) {
      logger.error("Failed to fetch pool addresses", {
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async prepareCreatePositionTransaction(
    poolAddress: PublicKey,
    lowerBinId: number,
    upperBinId: number,
    amountX: string,
    amountY: string,
    walletPublicKey: PublicKey
  ): Promise<{ transaction: string; positionMint: string }> {
    try {
      logger.info("Preparing position creation transaction", {
        poolAddress: poolAddress.toString(),
        lowerBinId,
        upperBinId,
        amountX,
        amountY,
      });

      // Get pair account to get active bin
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);
      const activeBinId = pairAccount.activeId;

      logger.debug("Retrieved pair account", {
        activeBinId,
        lowerBinId,
        upperBinId,
      });

      // Validate bin IDs
      if (lowerBinId >= upperBinId) {
        throw new Error(
          `Invalid bin range: lowerBinId (${lowerBinId}) must be less than upperBinId (${upperBinId})`
        );
      }

      // Calculate relative bin IDs from active bin
      const relativeBinIdLeft = lowerBinId - activeBinId;
      const relativeBinIdRight = upperBinId - activeBinId;

      // Calculate bin array index from the lower bin ID
      const binArrayIndex = Math.floor(lowerBinId / 70);

      // Validate relative bin IDs are within acceptable range
      if (
        Math.abs(relativeBinIdLeft) > 1000 ||
        Math.abs(relativeBinIdRight) > 1000
      ) {
        throw new Error(
          `Position too far from active bin. Active: ${activeBinId}, Lower: ${lowerBinId}, Upper: ${upperBinId}`
        );
      }

      logger.info("Calculated position parameters", {
        activeBinId,
        lowerBinId,
        upperBinId,
        relativeBinIdLeft,
        relativeBinIdRight,
        totalBins: upperBinId - lowerBinId + 1,
      });

      // Validate position doesn't span too many bins (max 140 bins per position)
      const totalBins = upperBinId - lowerBinId + 1;
      if (totalBins > 140) {
        throw new Error(
          `Position spans too many bins (${totalBins}). Maximum is 140 bins.`
        );
      }

      // Generate a new position mint
      const positionMint = Keypair.generate();
      const transaction = new Transaction();

      // Create position with bin array index
      await this.sarosDLMM.createPosition({
        pair: poolAddress,
        payer: walletPublicKey,
        relativeBinIdLeft,
        relativeBinIdRight,
        binArrayIndex,
        positionMint: positionMint.publicKey,
        transaction,
      });

      // Get recent blockhash and set fee payer
      const { blockhash, lastValidBlockHeight } =
        await this.connection.getLatestBlockhash("finalized");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = walletPublicKey;

      // Add position mint as partial signer (needs to be signed on client side too)
      transaction.partialSign(positionMint);

      // Serialize transaction for client signing
      const serializedTx = transaction
        .serialize({ requireAllSignatures: false })
        .toString("base64");

      logger.info("Position creation transaction prepared successfully", {
        positionMint: positionMint.publicKey.toString(),
        blockhash,
        lowerBinId,
        upperBinId,
        relativeBinIdLeft,
        relativeBinIdRight,
      });

      return {
        transaction: serializedTx,
        positionMint: positionMint.publicKey.toString(),
      };
    } catch (error) {
      logger.error("Failed to prepare position creation transaction", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async createPosition(
    poolAddress: PublicKey,
    lowerBinId: number,
    upperBinId: number,
    amountX: string,
    amountY: string,
    wallet: Keypair
  ): Promise<string> {
    try {
      logger.info("Creating position", {
        poolAddress: poolAddress.toString(),
        lowerBinId,
        upperBinId,
        amountX,
        amountY,
      });
      // Calculate relative bin IDs from the active bin
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);
      const activeBinId = pairAccount.activeId;
      logger.debug("Retrieved pair account", { activeBinId });
      const relativeBinIdLeft = lowerBinId - activeBinId;
      const relativeBinIdRight = upperBinId - activeBinId;

      // Calculate bin array index from the lower bin ID
      const binArrayIndex = Math.floor(lowerBinId / 70);

      // Generate a new position mint
      const positionMint = Keypair.generate();
      const transaction = new Transaction();

      const result = await this.sarosDLMM.createPosition({
        pair: poolAddress,
        payer: wallet.publicKey,
        relativeBinIdLeft,
        relativeBinIdRight,
        binArrayIndex,
        positionMint: positionMint.publicKey,
        transaction,
      });

      return result.position;
    } catch (error) {
      logger.error("Failed to create position", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async addLiquidity(
    positionInfo: Position,
    amountX: string,
    amountY: string,
    wallet: Keypair
  ): Promise<string> {
    try {
      // Get position mint from position info
      const positionAccount = await this.sarosDLMM.getPositionAccount(
        new PublicKey(positionInfo.address)
      );
      const pairAccount = await this.sarosDLMM.getPairAccount(
        new PublicKey(positionInfo.poolAddress)
      );
      const activeBinId = pairAccount.activeId;

      // Calculate bin array indices
      const binArrayLowerIndex = Math.floor(positionInfo.lowerBinId / 70);
      const binArrayUpperIndex = Math.floor(positionInfo.upperBinId / 70);

      // Get bin array addresses
      const binArrayLower = await this.sarosDLMM.getBinArray({
        pair: new PublicKey(positionInfo.poolAddress),
        binArrayIndex: binArrayLowerIndex,
      });
      const binArrayUpper = await this.sarosDLMM.getBinArray({
        pair: new PublicKey(positionInfo.poolAddress),
        binArrayIndex: binArrayUpperIndex,
      });

      // Create liquidity distribution
      const liquidityDistribution = [];
      for (
        let binId = positionInfo.lowerBinId;
        binId <= positionInfo.upperBinId;
        binId++
      ) {
        liquidityDistribution.push({
          relativeBinId: binId - activeBinId,
          distributionX: 50,
          distributionY: 50,
        });
      }

      const transaction = new Transaction();
      await this.sarosDLMM.addLiquidityIntoPosition({
        positionMint: positionAccount.positionMint,
        payer: wallet.publicKey,
        pair: new PublicKey(positionInfo.poolAddress),
        transaction,
        liquidityDistribution,
        amountX: parseFloat(amountX),
        amountY: parseFloat(amountY),
        binArrayLower,
        binArrayUpper,
      });

      return transaction.signature?.toString() || "success";
    } catch (error) {
      console.error("Failed to add liquidity:", error);
      throw error;
    }
  }

  async removeLiquidity(
    positionInfo: Position,
    bpsToRemove: number,
    wallet: Keypair
  ): Promise<string> {
    try {
      const positionAccount = await this.sarosDLMM.getPositionAccount(
        new PublicKey(positionInfo.address)
      );
      const pairAccount = await this.sarosDLMM.getPairAccount(
        new PublicKey(positionInfo.poolAddress)
      );

      const result = await this.sarosDLMM.removeMultipleLiquidity({
        maxPositionList: [
          {
            position: positionInfo.address,
            start: positionInfo.lowerBinId,
            end: positionInfo.upperBinId,
            positionMint: positionAccount.positionMint.toString(),
          },
        ],
        payer: wallet.publicKey,
        type: "removeBoth",
        pair: new PublicKey(positionInfo.poolAddress),
        tokenMintX: pairAccount.tokenMintX,
        tokenMintY: pairAccount.tokenMintY,
        activeId: pairAccount.activeId,
      });

      return result.txs[0]?.signature?.toString() || "success";
    } catch (error) {
      console.error("Failed to remove liquidity:", error);
      throw error;
    }
  }

  async claimFees(positionInfo: Position, wallet: Keypair): Promise<string> {
    try {
      const positionAccount = await this.sarosDLMM.getPositionAccount(
        new PublicKey(positionInfo.address)
      );
      const pairAccount = await this.sarosDLMM.getPairAccount(
        new PublicKey(positionInfo.poolAddress)
      );

      // Claim fees by removing liquidity with type 'removeBoth'
      const result = await this.sarosDLMM.removeMultipleLiquidity({
        maxPositionList: [
          {
            position: positionInfo.address,
            start: positionInfo.lowerBinId,
            end: positionInfo.upperBinId,
            positionMint: positionAccount.positionMint.toString(),
          },
        ],
        payer: wallet.publicKey,
        type: "removeBoth",
        pair: new PublicKey(positionInfo.poolAddress),
        tokenMintX: pairAccount.tokenMintX,
        tokenMintY: pairAccount.tokenMintY,
        activeId: pairAccount.activeId,
      });

      return result.txs[0]?.signature?.toString() || "success";
    } catch (error) {
      console.error("Failed to claim fees:", error);
      throw error;
    }
  }

  /**
   * Rebalance a position by creating a new position with optimized range
   * Returns unsigned transaction for wallet to sign
   */
  async rebalancePosition(
    positionInfo: Position,
    newLowerBinId: number,
    newUpperBinId: number,
    walletPublicKey: PublicKey,
    liquidityAmountX?: string,
    liquidityAmountY?: string
  ): Promise<{
    transaction: string;
    positionMint: string;
    oldRange: { lowerBinId: number; upperBinId: number };
    newRange: { lowerBinId: number; upperBinId: number };
    activeBinId: number;
  }> {
    try {
      logger.info("Starting rebalance transaction preparation", {
        positionAddress: positionInfo.address,
        oldRange: {
          lower: positionInfo.lowerBinId,
          upper: positionInfo.upperBinId,
        },
        newRange: { lower: newLowerBinId, upper: newUpperBinId },
        liquidityAmounts:
          liquidityAmountX || liquidityAmountY
            ? {
                tokenX: liquidityAmountX || "0",
                tokenY: liquidityAmountY || "0",
              }
            : "none (empty position)",
      });

      // Get position and pair accounts - CRITICAL: fetch LATEST on-chain active bin
      const positionAccount = await this.sarosDLMM.getPositionAccount(
        new PublicKey(positionInfo.address)
      );
      const pairAccount = await this.sarosDLMM.getPairAccount(
        new PublicKey(positionInfo.poolAddress)
      );
      const activeBinId = pairAccount.activeId;

      logger.info("Retrieved LATEST on-chain accounts", {
        positionMint: positionAccount.positionMint.toString(),
        activeBinId,
        providedNewRange: { lower: newLowerBinId, upper: newUpperBinId },
      });

      // Enforce standard 16-bin position (relative width = 15)
      const expectedWidth = 15;
      if (newUpperBinId - newLowerBinId !== expectedWidth) {
        logger.warn("Adjusting to standard 16-bin position");
        newLowerBinId = activeBinId - 7; // relativeLeft = -7
        newUpperBinId = activeBinId + 8; // relativeRight = 8, width = 15
      }

      const relativeBinIdLeft = newLowerBinId - activeBinId; // Must be negative, e.g., -7
      const relativeBinIdRight = newUpperBinId - activeBinId; // Must be positive, e.g., 8

      // Bin array size in Saros DLMM: 256 bins per array
      const BIN_ARRAY_SIZE = 256;
      const binArrayIndex = Math.floor(newLowerBinId / BIN_ARRAY_SIZE);

      // Calculate array span
      const lowerArrayIndex = Math.floor(newLowerBinId / BIN_ARRAY_SIZE);
      const upperArrayIndex = Math.floor(newUpperBinId / BIN_ARRAY_SIZE);
      if (upperArrayIndex - lowerArrayIndex > 1) {
        throw new Error(
          `Position spans more than 2 bin arrays: ${upperArrayIndex - lowerArrayIndex + 1}`
        );
      }

      const inclusiveBins = newUpperBinId - newLowerBinId + 1; // Should be 16
      if (inclusiveBins !== 16) {
        throw new Error(
          `Invalid inclusive bin count: ${inclusiveBins} (must be 16)`
        );
      }

      logger.info("Bin range details (16 bins)", {
        activeBinId,
        newLowerBinId,
        newUpperBinId,
        relativeBinIdLeft,
        relativeBinIdRight,
        binArrayIndex,
        arraySpan: upperArrayIndex - lowerArrayIndex + 1,
        inclusiveBins,
      });

      // Validate bin range - CRITICAL: relativeBinIdLeft must be NEGATIVE and relativeBinIdRight POSITIVE
      if (relativeBinIdLeft >= 0) {
        throw new Error(
          `Invalid left bin: ${relativeBinIdLeft} must be negative (left of active bin ${activeBinId})`
        );
      }

      if (relativeBinIdRight <= 0) {
        throw new Error(
          `Invalid right bin: ${relativeBinIdRight} must be positive (right of active bin ${activeBinId})`
        );
      }

      // Ensure active bin is strictly within the range
      if (!(activeBinId > newLowerBinId && activeBinId < newUpperBinId)) {
        throw new Error(
          `Active bin ${activeBinId} is not strictly within range [${newLowerBinId}, ${newUpperBinId}]`
        );
      }

      const newPositionMint = Keypair.generate();
      const createPositionTx = new Transaction();

      logger.info("Calling DLMM createPosition with params", {
        pair: positionInfo.poolAddress,
        payer: walletPublicKey.toString(),
        relativeBinIdLeft,
        relativeBinIdRight,
        binArrayIndex,
        positionMint: newPositionMint.publicKey.toString(),
        validation: {
          leftIsNegative: relativeBinIdLeft < 0,
          rightIsPositive: relativeBinIdRight > 0,
          activeBinInRange:
            activeBinId > newLowerBinId && activeBinId < newUpperBinId,
          inclusiveBins,
        },
        absoluteBins: {
          newLowerBinId,
          newUpperBinId,
          activeBinId,
        },
        binArrayCalculation: {
          formula: "Math.floor(newLowerBinId / 256)",
          newLowerBinId,
          division: newLowerBinId / 256,
          result: binArrayIndex,
        },
      });

      console.log("\n=== CRITICAL DEBUG: BIN ARRAY INDEX CALCULATION ===");
      console.log("newLowerBinId:", newLowerBinId);
      console.log("newUpperBinId:", newUpperBinId);
      console.log("activeBinId:", activeBinId);
      console.log("relativeBinIdLeft:", relativeBinIdLeft, "(should be < 0)");
      console.log("relativeBinIdRight:", relativeBinIdRight, "(should be > 0)");
      console.log(
        "binArrayIndex calculation: Math.floor(" + newLowerBinId + " / 256) =",
        binArrayIndex
      );
      console.log("Inclusive bins:", inclusiveBins, "(should =16)");
      console.log(
        "Array span:",
        upperArrayIndex - lowerArrayIndex + 1,
        "(should <=2)"
      );
      console.log("=== END CRITICAL DEBUG ===\n");

      // Create position
      await this.sarosDLMM.createPosition({
        pair: new PublicKey(positionInfo.poolAddress),
        payer: walletPublicKey,
        relativeBinIdLeft,
        relativeBinIdRight,
        binArrayIndex,
        positionMint: newPositionMint.publicKey,
        transaction: createPositionTx,
      });

      logger.info("DLMM createPosition call completed successfully");

      // Initialize all spanned bin arrays
      for (let idx = lowerArrayIndex; idx <= upperArrayIndex; idx++) {
        await this.sarosDLMM.getBinArray({
          pair: new PublicKey(positionInfo.poolAddress),
          binArrayIndex: idx,
          payer: walletPublicKey,
          transaction: createPositionTx,
        });
        logger.debug("Initialized bin array", { index: idx });
      }

      // Add liquidity if provided
      if (liquidityAmountX || liquidityAmountY) {
        const minLiquidityX = Number(liquidityAmountX || "0");
        const minLiquidityY = Number(liquidityAmountY || "0");

        logger.info("Adding liquidity to new position", {
          amountX: minLiquidityX,
          amountY: minLiquidityY,
        });

        // Get bin arrays for addition
        const binArrayLower = await this.sarosDLMM.getBinArray({
          pair: new PublicKey(positionInfo.poolAddress),
          binArrayIndex: lowerArrayIndex,
        });
        const binArrayUpper = await this.sarosDLMM.getBinArray({
          pair: new PublicKey(positionInfo.poolAddress),
          binArrayIndex: upperArrayIndex,
        });

        // Liquidity distribution for 16 bins
        const liquidityDistribution = [];
        for (let binId = newLowerBinId; binId <= newUpperBinId; binId++) {
          liquidityDistribution.push({
            relativeBinId: binId - activeBinId,
            distributionX: 50,
            distributionY: 50,
          });
        }

        await this.sarosDLMM.addLiquidityIntoPosition({
          pair: new PublicKey(positionInfo.poolAddress),
          payer: walletPublicKey,
          positionMint: newPositionMint.publicKey,
          amountX: minLiquidityX,
          amountY: minLiquidityY,
          transaction: createPositionTx,
          liquidityDistribution,
          binArrayLower,
          binArrayUpper,
        });

        logger.info("Liquidity added to new position successfully");
      }

      // Serialize transaction
      const { blockhash } =
        await this.connection.getLatestBlockhash("finalized");
      createPositionTx.recentBlockhash = blockhash;
      createPositionTx.feePayer = walletPublicKey;
      createPositionTx.partialSign(newPositionMint);

      const serializedTx = createPositionTx
        .serialize({ requireAllSignatures: false })
        .toString("base64");

      logger.info("Rebalance transaction prepared successfully", {
        newPositionMint: newPositionMint.publicKey.toString(),
        oldRange: {
          lowerBinId: positionInfo.lowerBinId,
          upperBinId: positionInfo.upperBinId,
        },
        newRange: { lowerBinId: newLowerBinId, upperBinId: newUpperBinId },
        txSize: serializedTx.length,
      });

      return {
        transaction: serializedTx,
        positionMint: newPositionMint.publicKey.toString(),
        oldRange: {
          lowerBinId: positionInfo.lowerBinId,
          upperBinId: positionInfo.upperBinId,
        },
        newRange: { lowerBinId: newLowerBinId, upperBinId: newUpperBinId },
        activeBinId,
      };
    } catch (error) {
      logger.error("Failed to prepare rebalance transaction", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  async getActiveBin(poolAddress: PublicKey): Promise<any> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);

      if (!pairAccount) {
        throw new Error("Pool not found");
      }

      const activeBinId = pairAccount.activeId;
      const binStep = pairAccount.binStep;
      const price = this.binIdToPrice(activeBinId, binStep);

      return {
        binId: activeBinId,
        price,
        binStep,
      };
    } catch (error) {
      console.error("Failed to fetch active bin:", error);
      throw error;
    }
  }

  async getActiveBins(
    poolAddress: PublicKey,
    count: number = 20
  ): Promise<any[]> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);

      if (!pairAccount) {
        throw new Error("Pool not found");
      }

      const activeBinId = pairAccount.activeId;
      const binStep = pairAccount.binStep;

      // Get bins around the active bin
      const startBinId = activeBinId - Math.floor(count / 2);
      const endBinId = activeBinId + Math.floor(count / 2);

      const bins = [];
      for (let binId = startBinId; binId <= endBinId; binId++) {
        const price = this.binIdToPrice(binId, binStep);
        bins.push({
          binId,
          price,
          isActive: binId === activeBinId,
        });
      }

      return bins;
    } catch (error) {
      console.error("Failed to fetch active bins:", error);
      return [];
    }
  }

  async getBinArrays(poolAddress: PublicKey): Promise<any[]> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);

      if (!pairAccount) {
        throw new Error("Pool not found");
      }

      const activeBinId = pairAccount.activeId;
      const binStep = pairAccount.binStep;

      // Get bin arrays around active bin
      const activeBinArrayIndex = Math.floor(activeBinId / 70);
      const binArrays = [];

      for (let i = -2; i <= 2; i++) {
        const index = activeBinArrayIndex + i;
        try {
          const binArray = await this.sarosDLMM.getBinArray({
            pair: poolAddress,
            binArrayIndex: index,
          });

          if (binArray) {
            binArrays.push({
              index,
              binArray,
            });
          }
        } catch (error) {
          // Skip missing bin arrays
          continue;
        }
      }

      return binArrays;
    } catch (error) {
      console.error("Failed to fetch bin arrays:", error);
      return [];
    }
  }

  async getQuote(
    poolAddress: PublicKey,
    amountIn: string,
    swapForY: boolean
  ): Promise<any> {
    try {
      const metadata = await this.sarosDLMM.fetchPoolMetadata(
        poolAddress.toString()
      );
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);

      const quote = await this.sarosDLMM.getQuote({
        pair: poolAddress,
        tokenBase: pairAccount.tokenMintX,
        tokenQuote: pairAccount.tokenMintY,
        amount: BigInt(amountIn),
        swapForY,
        isExactInput: true,
        tokenBaseDecimal: metadata.extra.tokenBaseDecimal,
        tokenQuoteDecimal: metadata.extra.tokenQuoteDecimal,
        slippage: 0.5,
      });

      return quote;
    } catch (error) {
      console.error("Failed to get quote:", error);
      throw error;
    }
  }

  async getBinLiquidity(poolAddress: PublicKey, binId: number): Promise<any> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);

      if (!pairAccount) {
        throw new Error("Pool not found");
      }

      const binStep = pairAccount.binStep;
      const price = this.binIdToPrice(binId, binStep);

      // Get bin array that contains this bin
      const binArrayIndex = Math.floor(binId / 70); // Bins are grouped in arrays of 70

      try {
        const binArray = await this.sarosDLMM.getBinArray({
          pair: poolAddress,
          binArrayIndex: binArrayIndex,
        });

        // Get bin info from the array
        const binInfo = await this.sarosDLMM.getBinArrayInfo({
          pair: poolAddress,
          payer: poolAddress,
          binArrayIndex,
        });

        return {
          binId,
          price,
          reserveX: binInfo.bins[binId % 70]?.amountX || "0",
          reserveY: binInfo.bins[binId % 70]?.amountY || "0",
        };
      } catch (err) {
        // Bin array might not exist
        return {
          binId,
          price,
          reserveX: "0",
          reserveY: "0",
        };
      }
    } catch (error) {
      console.error("Failed to fetch bin liquidity:", error);
      throw error;
    }
  }

  async getSwapQuote(
    poolAddress: PublicKey,
    amountIn: string,
    swapForY: boolean
  ): Promise<any> {
    try {
      const metadata = await this.sarosDLMM.fetchPoolMetadata(
        poolAddress.toString()
      );

      if (!metadata) {
        throw new Error("Pool not found");
      }

      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);

      const quote = await this.sarosDLMM.getQuote({
        pair: poolAddress,
        tokenBase: pairAccount.tokenMintX,
        tokenQuote: pairAccount.tokenMintY,
        amount: BigInt(amountIn),
        swapForY,
        isExactInput: true,
        tokenBaseDecimal: metadata.extra.tokenBaseDecimal,
        tokenQuoteDecimal: metadata.extra.tokenQuoteDecimal,
        slippage: 0.5,
      });

      return {
        amountIn: amountIn,
        amountOut: quote.amountOut?.toString() || "0",
        fee: "0",
        priceImpact: 0,
      };
    } catch (error) {
      console.error("Failed to get swap quote:", error);
      throw error;
    }
  }

  async executeSwap(
    poolAddress: PublicKey,
    amountIn: string,
    minAmountOut: string,
    swapForY: boolean,
    wallet: Keypair
  ): Promise<string> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);

      const result = await this.sarosDLMM.swap({
        tokenMintX: pairAccount.tokenMintX,
        tokenMintY: pairAccount.tokenMintY,
        amount: BigInt(amountIn),
        otherAmountOffset: BigInt(minAmountOut),
        swapForY,
        isExactInput: true,
        pair: poolAddress,
        hook: pairAccount.hook || PublicKey.default,
        payer: wallet.publicKey,
      });

      const signature = result.signature?.toString() || "success";

      return signature;
    } catch (error) {
      console.error("Failed to execute swap:", error);
      throw error;
    }
  }

  // Helper function to convert bin ID to price
  private binIdToPrice(binId: number, binStep: number): number {
    // DLMM uses a different formula: price = (1 + binStep/10000)^(binId - 8388608)
    // 8388608 is the reference bin ID (2^23) where price = 1
    const REFERENCE_BIN_ID = 8388608;
    const basisPoints = binStep / 10000;
    const exponent = binId - REFERENCE_BIN_ID;

    // For large exponents, use logarithmic calculation to avoid overflow
    if (Math.abs(exponent) > 10000) {
      // price = exp(exponent * ln(1 + basisPoints))
      const logPrice = exponent * Math.log(1 + basisPoints);
      return Math.exp(logPrice);
    }

    return Math.pow(1 + basisPoints, exponent);
  }

  // Helper function to convert price to bin ID
  private priceToBinId(price: number, binStep: number): number {
    // DLMM formula: binId = floor(log(price) / log(1 + binStep/10000)) + REFERENCE_BIN_ID
    const REFERENCE_BIN_ID = 8388608;
    const basisPoints = binStep / 10000;
    const binId =
      Math.floor(Math.log(price) / Math.log(1 + basisPoints)) +
      REFERENCE_BIN_ID;
    return binId;
  }

  // Calculate position value in USD
  async getPositionValue(position: Position): Promise<number> {
    try {
      const poolInfo = await this.getPoolInfo(
        new PublicKey(position.poolAddress)
      );

      const liquidityX =
        parseFloat(position.liquidityX) /
        Math.pow(10, poolInfo.tokenX.decimals);
      const liquidityY =
        parseFloat(position.liquidityY) /
        Math.pow(10, poolInfo.tokenY.decimals);

      // Assuming tokenY is the quote token (e.g., USDC)
      const valueX = liquidityX * poolInfo.currentPrice;
      const valueY = liquidityY;

      return valueX + valueY;
    } catch (error) {
      console.error("Failed to calculate position value:", error);
      return 0;
    }
  }

  // Calculate impermanent loss for a position
  calculateImpermanentLoss(
    initialPrice: number,
    currentPrice: number,
    initialValueX: number,
    initialValueY: number
  ): number {
    const priceRatio = currentPrice / initialPrice;
    const sqrtPriceRatio = Math.sqrt(priceRatio);

    // Calculate value if held
    const heldValue = initialValueX * priceRatio + initialValueY;

    // Calculate value in LP
    const lpValue =
      2 * sqrtPriceRatio * (initialValueX + initialValueY / initialPrice);

    // IL as percentage
    const il = ((lpValue - heldValue) / heldValue) * 100;

    return il;
  }

  // Get position performance metrics
  async getPositionMetrics(position: Position): Promise<{
    currentValue: number;
    feesEarned: number;
    impermanentLoss: number;
    totalReturn: number;
  }> {
    try {
      const currentValue = await this.getPositionValue(position);

      const poolInfo = await this.getPoolInfo(
        new PublicKey(position.poolAddress)
      );

      const feeX =
        parseFloat(position.feeX) / Math.pow(10, poolInfo.tokenX.decimals);
      const feeY =
        parseFloat(position.feeY) / Math.pow(10, poolInfo.tokenY.decimals);
      const feesEarned = feeX * poolInfo.currentPrice + feeY;

      // For IL calculation, we'd need initial price (stored separately)
      // This is a simplified version
      const impermanentLoss = 0;

      const totalReturn =
        ((currentValue + feesEarned - currentValue) / currentValue) * 100;

      return {
        currentValue,
        feesEarned,
        impermanentLoss,
        totalReturn,
      };
    } catch (error) {
      console.error("Failed to calculate position metrics:", error);
      return {
        currentValue: 0,
        feesEarned: 0,
        impermanentLoss: 0,
        totalReturn: 0,
      };
    }
  }
}

export const dlmmClient = new DLMMClient();
