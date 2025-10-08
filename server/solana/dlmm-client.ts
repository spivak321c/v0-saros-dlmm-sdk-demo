import { Connection, PublicKey, Keypair, Transaction } from '@solana/web3.js';
import { getConnection } from './connection';
import type { PoolInfo, Position } from '../../shared/schema';
import { LiquidityBookServices, MODE } from '@saros-finance/dlmm-sdk';

export class DLMMClient {
  private connection: Connection;
  private sarosDLMM: LiquidityBookServices;

  constructor() {
    this.connection = getConnection();
    this.sarosDLMM = new LiquidityBookServices({
      mode: MODE.MAINNET,
      options: {
        rpcUrl: this.connection.rpcEndpoint,
      },
    });
  }

  async getPoolInfo(poolAddress: PublicKey): Promise<PoolInfo> {
    try {
      // Fetch pool metadata using the SDK
      const metadata = await this.sarosDLMM.fetchPoolMetadata(poolAddress.toString());
      
      if (!metadata) {
        throw new Error('Pool not found');
      }

      // Get pair account for detailed state
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);
      
      // Calculate current price from active bin
      const activeBinId = pairAccount.activeId;
      const currentPrice = this.binIdToPrice(activeBinId, pairAccount.binStep);
      
      return {
        address: poolAddress.toString(),
        tokenX: {
          mint: metadata.baseMint,
          symbol: 'Unknown',
          decimals: metadata.extra.tokenBaseDecimal,
        },
        tokenY: {
          mint: metadata.quoteMint,
          symbol: 'Unknown',
          decimals: metadata.extra.tokenQuoteDecimal,
        },
        binStep: pairAccount.binStep,
        activeId: pairAccount.activeId,
        currentPrice,
        tvl: 0,
        volume24h: 0,
        fees24h: 0,
      };
    } catch (error) {
      console.error('Failed to fetch pool info:', error);
      throw error;
    }
  }

  async getUserPositions(walletAddress: PublicKey): Promise<Position[]> {
    try {
      // Get all pool addresses first
      const poolAddresses = await this.sarosDLMM.fetchPoolAddresses();
      const allPositions: Position[] = [];
      
      // Query positions for each pool
      for (const poolAddr of poolAddresses.slice(0, 10)) { // Limit to first 10 pools for performance
        try {
          const positions = await this.sarosDLMM.getUserPositions({
            payer: walletAddress,
            pair: new PublicKey(poolAddr)
          });
          
          if (positions && positions.length > 0) {
            for (const position of positions) {
              allPositions.push({
                address: position.publicKey.toString(),
                poolAddress: poolAddr,
                owner: walletAddress.toString(),
                lowerBinId: position.lowerBinId || 0,
                upperBinId: position.upperBinId || 0,
                liquidityX: position.totalXAmount?.toString() || '0',
                liquidityY: position.totalYAmount?.toString() || '0',
                feeX: position.feeX?.toString() || '0',
                feeY: position.feeY?.toString() || '0',
                rewardOne: position.rewardOne?.toString() || '0',
                rewardTwo: position.rewardTwo?.toString() || '0',
                lastUpdatedAt: position.lastUpdatedAt || Date.now(),
                createdAt: position.lastUpdatedAt || Date.now(),
              });
            }
          }
        } catch (err) {
          // Skip pools where user has no positions or errors occur
          continue;
        }
      }
      
      return allPositions;
    } catch (error) {
      console.error('Failed to fetch user positions:', error);
      return [];
    }
  }

  async getPositionInfo(positionAddress: PublicKey): Promise<Position | null> {
    try {
      const positionAccount = await this.sarosDLMM.getPositionAccount(positionAddress);
      
      if (!positionAccount) return null;
      
      return {
        address: positionAddress.toString(),
        poolAddress: positionAccount.lbPair.toString(),
        owner: positionAccount.owner.toString(),
        lowerBinId: positionAccount.lowerBinId || 0,
        upperBinId: positionAccount.upperBinId || 0,
        liquidityX: positionAccount.totalXAmount?.toString() || '0',
        liquidityY: positionAccount.totalYAmount?.toString() || '0',
        feeX: positionAccount.feeX?.toString() || '0',
        feeY: positionAccount.feeY?.toString() || '0',
        rewardOne: positionAccount.rewardOne?.toString() || '0',
        rewardTwo: positionAccount.rewardTwo?.toString() || '0',
        lastUpdatedAt: positionAccount.lastUpdatedAt || Date.now(),
        createdAt: positionAccount.lastUpdatedAt || Date.now(),
      };
    } catch (error) {
      console.error('Failed to fetch position info:', error);
      return null;
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
      // Calculate relative bin IDs from the active bin
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);
      const activeBinId = pairAccount.activeId;
      const relativeBinIdLeft = lowerBinId - activeBinId;
      const relativeBinIdRight = upperBinId - activeBinId;
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
      console.error('Failed to create position:', error);
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
      const positionAccount = await this.sarosDLMM.getPositionAccount(new PublicKey(positionInfo.address));
      const pairAccount = await this.sarosDLMM.getPairAccount(new PublicKey(positionInfo.poolAddress));
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
      for (let binId = positionInfo.lowerBinId; binId <= positionInfo.upperBinId; binId++) {
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
      
      return transaction.signature?.toString() || 'success';
    } catch (error) {
      console.error('Failed to add liquidity:', error);
      throw error;
    }
  }

  async removeLiquidity(
    positionInfo: Position,
    bpsToRemove: number,
    wallet: Keypair
  ): Promise<string> {
    try {
      const positionAccount = await this.sarosDLMM.getPositionAccount(new PublicKey(positionInfo.address));
      const pairAccount = await this.sarosDLMM.getPairAccount(new PublicKey(positionInfo.poolAddress));
      
      const result = await this.sarosDLMM.removeMultipleLiquidity({
        maxPositionList: [{
          position: positionInfo.address,
          start: positionInfo.lowerBinId,
          end: positionInfo.upperBinId,
          positionMint: positionAccount.positionMint.toString(),
        }],
        payer: wallet.publicKey,
        type: 'removeBoth',
        pair: new PublicKey(positionInfo.poolAddress),
        tokenMintX: pairAccount.tokenMintX,
        tokenMintY: pairAccount.tokenMintY,
        activeId: pairAccount.activeId,
      });
      
      return result.txs[0]?.signature?.toString() || 'success';
    } catch (error) {
      console.error('Failed to remove liquidity:', error);
      throw error;
    }
  }

  async claimFees(
    positionInfo: Position,
    wallet: Keypair
  ): Promise<string> {
    try {
      const positionAccount = await this.sarosDLMM.getPositionAccount(new PublicKey(positionInfo.address));
      const pairAccount = await this.sarosDLMM.getPairAccount(new PublicKey(positionInfo.poolAddress));
      
      // Claim fees by removing liquidity with type 'removeBoth'
      const result = await this.sarosDLMM.removeMultipleLiquidity({
        maxPositionList: [{
          position: positionInfo.address,
          start: positionInfo.lowerBinId,
          end: positionInfo.upperBinId,
          positionMint: positionAccount.positionMint.toString(),
        }],
        payer: wallet.publicKey,
        type: 'removeBoth',
        pair: new PublicKey(positionInfo.poolAddress),
        tokenMintX: pairAccount.tokenMintX,
        tokenMintY: pairAccount.tokenMintY,
        activeId: pairAccount.activeId,
      });
      
      return result.txs[0]?.signature?.toString() || 'success';
    } catch (error) {
      console.error('Failed to claim fees:', error);
      throw error;
    }
  }

  async getActiveBin(poolAddress: PublicKey): Promise<any> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);
      
      if (!pairAccount) {
        throw new Error('Pool not found');
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
      console.error('Failed to fetch active bin:', error);
      throw error;
    }
  }

  async getActiveBins(poolAddress: PublicKey, count: number = 20): Promise<any[]> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);
      
      if (!pairAccount) {
        throw new Error('Pool not found');
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
      console.error('Failed to fetch active bins:', error);
      return [];
    }
  }

  async getBinArrays(poolAddress: PublicKey): Promise<any[]> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);
      
      if (!pairAccount) {
        throw new Error('Pool not found');
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
      console.error('Failed to fetch bin arrays:', error);
      return [];
    }
  }

  async getQuote(poolAddress: PublicKey, amountIn: string, swapForY: boolean): Promise<any> {
    try {
      const metadata = await this.sarosDLMM.fetchPoolMetadata(poolAddress.toString());
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
      console.error('Failed to get quote:', error);
      throw error;
    }
  }

  async getBinLiquidity(poolAddress: PublicKey, binId: number): Promise<any> {
    try {
      const pairAccount = await this.sarosDLMM.getPairAccount(poolAddress);
      
      if (!pairAccount) {
        throw new Error('Pool not found');
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
          reserveX: binInfo.bins[binId % 70]?.amountX || '0',
          reserveY: binInfo.bins[binId % 70]?.amountY || '0',
        };
      } catch (err) {
        // Bin array might not exist
        return {
          binId,
          price,
          reserveX: '0',
          reserveY: '0',
        };
      }
    } catch (error) {
      console.error('Failed to fetch bin liquidity:', error);
      throw error;
    }
  }

  async getSwapQuote(
    poolAddress: PublicKey,
    amountIn: string,
    swapForY: boolean
  ): Promise<any> {
    try {
      const metadata = await this.sarosDLMM.fetchPoolMetadata(poolAddress.toString());
      
      if (!metadata) {
        throw new Error('Pool not found');
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
        amountOut: quote.amountOut?.toString() || '0',
        fee: '0',
        priceImpact: 0,
      };
    } catch (error) {
      console.error('Failed to get swap quote:', error);
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

      const signature = result.signature?.toString() || 'success';

      return signature;
    } catch (error) {
      console.error('Failed to execute swap:', error);
      throw error;
    }
  }

  // Helper function to convert bin ID to price
  private binIdToPrice(binId: number, binStep: number): number {
    return Math.pow(1 + binStep / 10000, binId);
  }

  // Helper function to convert price to bin ID
  private priceToBinId(price: number, binStep: number): number {
    return Math.floor(Math.log(price) / Math.log(1 + binStep / 10000));
  }

  // Calculate position value in USD
  async getPositionValue(position: Position): Promise<number> {
    try {
      const poolInfo = await this.getPoolInfo(new PublicKey(position.poolAddress));
      
      const liquidityX = parseFloat(position.liquidityX) / Math.pow(10, poolInfo.tokenX.decimals);
      const liquidityY = parseFloat(position.liquidityY) / Math.pow(10, poolInfo.tokenY.decimals);
      
      // Assuming tokenY is the quote token (e.g., USDC)
      const valueX = liquidityX * poolInfo.currentPrice;
      const valueY = liquidityY;
      
      return valueX + valueY;
    } catch (error) {
      console.error('Failed to calculate position value:', error);
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
    const lpValue = 2 * sqrtPriceRatio * (initialValueX + initialValueY / initialPrice);
    
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
      
      const poolInfo = await this.getPoolInfo(new PublicKey(position.poolAddress));
      
      const feeX = parseFloat(position.feeX) / Math.pow(10, poolInfo.tokenX.decimals);
      const feeY = parseFloat(position.feeY) / Math.pow(10, poolInfo.tokenY.decimals);
      const feesEarned = feeX * poolInfo.currentPrice + feeY;
      
      // For IL calculation, we'd need initial price (stored separately)
      // This is a simplified version
      const impermanentLoss = 0;
      
      const totalReturn = ((currentValue + feesEarned - currentValue) / currentValue) * 100;
      
      return {
        currentValue,
        feesEarned,
        impermanentLoss,
        totalReturn,
      };
    } catch (error) {
      console.error('Failed to calculate position metrics:', error);
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
