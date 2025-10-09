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

      // Validate relative bin IDs are within acceptable range
      if (
        Math.abs(relativeBinIdLeft) > 1000 ||
        Math.abs(relativeBinIdRight) > 1000
      ) {
        throw new Error(
          `Position too far from active bin. Active: ${activeBinId}, Lower: ${lowerBinId}, Upper: ${upperBinId}`
        );
      }

      // Calculate bin array index - use the lower bin's array index
      // Each bin array contains 70 bins
      const binArrayIndex = Math.floor(lowerBinId / 70);
      const upperBinArrayIndex = Math.floor(upperBinId / 70);

      logger.info("Calculated position parameters", {
        activeBinId,
        lowerBinId,
        upperBinId,
        relativeBinIdLeft,
        relativeBinIdRight,
        binArrayIndex,
        upperBinArrayIndex,
        spansMultipleArrays: binArrayIndex !== upperBinArrayIndex,
        totalBins: upperBinId - lowerBinId + 1,
      });

      // Validate position doesn't span too many bins (max 140 bins per position)
      const totalBins = upperBinId - lowerBinId + 1;
      if (totalBins > 140) {
        throw new Error(
          `Position spans too many bins (${totalBins}). Maximum is 140 bins.`
        );
      }

      // Log if position spans multiple bin arrays
      if (binArrayIndex !== upperBinArrayIndex) {
        logger.info(
          "Position spans multiple bin arrays - SDK will handle initialization",
          {
            binArrayIndex,
            upperBinArrayIndex,
            totalArrays: upperBinArrayIndex - binArrayIndex + 1,
          }
        );
      }

      // Generate a new position mint
      const positionMint = Keypair.generate();
      const transaction = new Transaction();

      // Create position - SDK handles bin array initialization automatically
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
        binArrayIndex,
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
      // Calculate bin array index from the active bin ID
      const binArrayIndex = Math.floor(activeBinId / 70);

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

  /**
   * Rebalance a position by removing liquidity and creating a new position with optimized range
   */
  async rebalancePosition(
    positionInfo: Position,
    newLowerBinId: number,
    newUpperBinId: number,
    walletPublicKey: PublicKey
  ): Promise<{
    transaction: string;
    positionMint: string;
    oldRange: { lowerBinId: number; upperBinId: number };
    newRange: { lowerBinId: number; upperBinId: number };
  }> {
    try {
      logger.info("Starting rebalance transaction preparation", {
        positionAddress: positionInfo.address,
        oldRange: {
          lower: positionInfo.lowerBinId,
          upper: positionInfo.upperBinId,
        },
        newRange: { lower: newLowerBinId, upper: newUpperBinId },
      });

      // Get position and pair accounts
      const positionAccount = await this.sarosDLMM.getPositionAccount(
        new PublicKey(positionInfo.address)
      );
      const pairAccount = await this.sarosDLMM.getPairAccount(
        new PublicKey(positionInfo.poolAddress)
      );
      const activeBinId = pairAccount.activeId;

      logger.debug("Retrieved accounts", {
        positionMint: positionAccount.positionMint.toString(),
        activeBinId,
      });

      // Step 1: Remove all liquidity from old position
      const removeLiquidityTx = new Transaction();

      logger.info("Preparing remove liquidity transaction");
      const removeResult = await this.sarosDLMM.removeMultipleLiquidity({
        maxPositionList: [
          {
            position: positionInfo.address,
            start: positionInfo.lowerBinId,
            end: positionInfo.upperBinId,
            positionMint: positionAccount.positionMint.toString(),
          },
        ],
        payer: walletPublicKey,
        type: "removeBoth",
        pair: new PublicKey(positionInfo.poolAddress),
        tokenMintX: pairAccount.tokenMintX,
        tokenMintY: pairAccount.tokenMintY,
        activeId: pairAccount.activeId,
      });

      // Get the remove liquidity transaction
      if (!removeResult.txs || removeResult.txs.length === 0) {
        throw new Error("Failed to create remove liquidity transaction");
      }

      // Step 2: Create new position with optimized range
      const relativeBinIdLeft = newLowerBinId - activeBinId;
      const relativeBinIdRight = newUpperBinId - activeBinId;
      const binArrayIndex = Math.floor(newLowerBinId / 70);

      logger.info("Creating new position", {
        relativeBinIdLeft,
        relativeBinIdRight,
        binArrayIndex,
      });

      const newPositionMint = Keypair.generate();
      const createPositionTx = new Transaction();

      await this.sarosDLMM.createPosition({
        pair: new PublicKey(positionInfo.poolAddress),
        payer: walletPublicKey,
        relativeBinIdLeft,
        relativeBinIdRight,
        binArrayIndex,
        positionMint: newPositionMint.publicKey,
        transaction: createPositionTx,
      });

      // Step 3: Prepare to add liquidity to new position
      // Calculate liquidity amounts from removed position
      const liquidityX = parseFloat(positionInfo.liquidityX);
      const liquidityY = parseFloat(positionInfo.liquidityY);

      logger.info("Preparing add liquidity", {
        liquidityX,
        liquidityY,
      });

      // Get bin arrays for new position
      const binArrayLowerIndex = Math.floor(newLowerBinId / 70);
      const binArrayUpperIndex = Math.floor(newUpperBinId / 70);

      const binArrayLower = await this.sarosDLMM.getBinArray({
        pair: new PublicKey(positionInfo.poolAddress),
        binArrayIndex: binArrayLowerIndex,
        payer: walletPublicKey,
        transaction: createPositionTx,
      });

      const binArrayUpper = await this.sarosDLMM.getBinArray({
        pair: new PublicKey(positionInfo.poolAddress),
        binArrayIndex: binArrayUpperIndex,
        payer: walletPublicKey,
        transaction: createPositionTx,
      });

      // Create liquidity distribution (spot strategy - concentrated around active bin)
      const liquidityDistribution = [];
      for (let binId = newLowerBinId; binId <= newUpperBinId; binId++) {
        const relativeBinId = binId - activeBinId;
        // Spot distribution: 100% in active bin, 0% elsewhere
        if (binId === activeBinId) {
          liquidityDistribution.push({
            relativeBinId,
            distributionX: 50,
            distributionY: 50,
          });
        } else {
          liquidityDistribution.push({
            relativeBinId,
            distributionX: binId < activeBinId ? 100 : 0,
            distributionY: binId > activeBinId ? 100 : 0,
          });
        }
      }

      // Add liquidity to new position
      await this.sarosDLMM.addLiquidityIntoPosition({
        positionMint: newPositionMint.publicKey,
        payer: walletPublicKey,
        pair: new PublicKey(positionInfo.poolAddress),
        transaction: createPositionTx,
        liquidityDistribution,
        amountX: liquidityX,
        amountY: liquidityY,
        binArrayLower,
        binArrayUpper,
      });

      // Combine all transactions
      const combinedTx = new Transaction();

      // Add remove liquidity instructions
      removeResult.txs[0].instructions.forEach((ix) => combinedTx.add(ix));

      // Add create position and add liquidity instructions
      createPositionTx.instructions.forEach((ix) => combinedTx.add(ix));

      // Set transaction metadata
      const { blockhash } =
        await this.connection.getLatestBlockhash("finalized");
      combinedTx.recentBlockhash = blockhash;
      combinedTx.feePayer = walletPublicKey;

      // Partial sign with new position mint
      combinedTx.partialSign(newPositionMint);

      // Serialize for client signing
      const serializedTx = combinedTx
        .serialize({ requireAllSignatures: false })
        .toString("base64");

      logger.info("Rebalance transaction prepared successfully", {
        newPositionMint: newPositionMint.publicKey.toString(),
        oldRange: {
          lowerBinId: positionInfo.lowerBinId,
          upperBinId: positionInfo.upperBinId,
        },
        newRange: { lowerBinId: newLowerBinId, upperBinId: newUpperBinId },
      });

      return {
        transaction: serializedTx,
        positionMint: newPositionMint.publicKey.toString(),
        oldRange: {
          lowerBinId: positionInfo.lowerBinId,
          upperBinId: positionInfo.upperBinId,
        },
        newRange: { lowerBinId: newLowerBinId, upperBinId: newUpperBinId },
      };
    } catch (error) {
      logger.error("Failed to prepare rebalance transaction", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
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
