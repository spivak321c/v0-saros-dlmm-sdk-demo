import { Router } from "express";
import { PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { positionMonitor } from "./services/position-monitor";
import { volatilityTracker } from "./services/volatility-tracker";
import { rebalancer } from "./services/rebalancer";
import { ecoRebalancer } from "./services/eco-rebalancer";
import { stopLossManager } from "./services/stop-loss-manager";
import { telegramBot } from "./services/telegram-bot";
import { wsServer } from "./services/websocket-server";
import { dlmmClient } from "./solana/dlmm-client";
import { ilCalculator } from "./utils/il-calculator";
import { feeOptimizer } from "./utils/fee-optimizer";
import storage from "./storage";
import { logger } from "./utils/logger";
import type { ApiResponse } from "../shared/schema";

const router = Router();

// Positions
router.get("/positions/:wallet", async (req, res) => {
  try {
    const { wallet } = req.params;
    logger.info("GET /positions/:wallet", { wallet });

    // First try to load from blockchain
    const positions = await positionMonitor.loadUserPositions(wallet);
    logger.info("Loaded user positions from blockchain", {
      wallet,
      count: positions.length,
    });

    // Also include positions from storage (for positions without owner field)
    const allStoredPositions = storage.getAllPositions();
    const storedPositionsWithoutOwner = allStoredPositions.filter(
      (p) => !p.position.owner || p.position.owner === ""
    );

    // Merge both lists, avoiding duplicates
    const positionMap = new Map();
    positions.forEach((p) => positionMap.set(p.position.address, p));
    storedPositionsWithoutOwner.forEach((p) => {
      if (!positionMap.has(p.position.address)) {
        positionMap.set(p.position.address, p);
      }
    });

    const allPositions = Array.from(positionMap.values());
    logger.info("Total positions including storage", {
      wallet,
      count: allPositions.length,
    });

    const response: ApiResponse<typeof allPositions> = {
      success: true,
      data: allPositions,
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to load positions", {
      wallet: req.params.wallet,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to load positions",
      timestamp: Date.now(),
    });
  }
});

router.get("/positions/detail/:address", async (req, res) => {
  try {
    const { address } = req.params;
    logger.info("GET /positions/detail/:address", { address });
    const position = await positionMonitor.loadPositionData(address);
    logger.info("Loaded position detail", { address, found: !!position });

    const response: ApiResponse<typeof position> = {
      success: true,
      data: position || undefined,
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to load position detail", {
      address: req.params.address,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to load position",
      timestamp: Date.now(),
    });
  }
});

// Volatility
router.get("/volatility/:poolAddress", async (req, res) => {
  try {
    const { poolAddress } = req.params;
    logger.info("GET /volatility/:poolAddress", { poolAddress });
    const volatilityData =
      await volatilityTracker.updateVolatilityData(poolAddress);
    logger.info("Updated volatility data", {
      poolAddress,
      volatility: volatilityData.volatility,
    });

    const response: ApiResponse<typeof volatilityData> = {
      success: true,
      data: volatilityData,
      timestamp: Date.now(),
    };

    res.json(response);
  } catch (error) {
    logger.error("Failed to get volatility data", {
      poolAddress: req.params.poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get volatility data",
      timestamp: Date.now(),
    });
  }
});

// Rebalancing - Prepare unsigned transaction for wallet to sign
router.post("/rebalance", async (req, res) => {
  try {
    const { positionAddress, wallet } = req.body;
    logger.info("POST /rebalance", { positionAddress, wallet });

    if (!positionAddress || !wallet) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: positionAddress and wallet",
        timestamp: Date.now(),
      });
    }

    const shouldRebal = await rebalancer.shouldRebalance(positionAddress);
    logger.info("Checked rebalance necessity", {
      positionAddress,
      shouldRebalance: shouldRebal,
    });

    if (!shouldRebal) {
      return res.json({
        success: true,
        data: {
          needsRebalance: false,
          message: "Position does not need rebalancing",
        },
        timestamp: Date.now(),
      });
    }

    const positionData = storage.getPosition(positionAddress);
    if (!positionData) {
      throw new Error("Position not found");
    }

    logger.info("Position data loaded", {
      positionAddress,
      poolAddress: positionData.pool.address,
      currentActiveBinId: positionData.pool.activeId,
      currentPositionRange: {
        lower: positionData.position.lowerBinId,
        upper: positionData.position.upperBinId,
      },
    });

    const volatilityData = volatilityTracker.getVolatilityData(
      positionData.pool.address
    );
    const volatility = volatilityData?.volatility || 50;

    const newRange = rebalancer.calculateOptimalRange(
      positionData.pool.address,
      positionData.pool.activeId,
      volatility
    );

    logger.info("Preparing rebalance transaction", {
      positionAddress,
      newRange,
      activeBinId: positionData.pool.activeId,
      volatility,
      // Detailed validation info
      rangeValidation: {
        lowerBinId: newRange.lowerBinId,
        upperBinId: newRange.upperBinId,
        activeBinId: positionData.pool.activeId,
        relativeBinIdLeft: newRange.lowerBinId - positionData.pool.activeId,
        relativeBinIdRight: newRange.upperBinId - positionData.pool.activeId,
        lowerLessThanActive: newRange.lowerBinId < positionData.pool.activeId,
        upperGreaterThanActive:
          newRange.upperBinId > positionData.pool.activeId,
        rangeWidth: newRange.upperBinId - newRange.lowerBinId,
      },
    });

    // Extract optional liquidity amounts from request
    const { liquidityAmountX, liquidityAmountY } = req.body;

    // Prepare rebalance transaction using DLMM SDK
    const rebalanceResult = await dlmmClient.rebalancePosition(
      positionData.position,
      newRange.lowerBinId,
      newRange.upperBinId,
      new PublicKey(wallet),
      liquidityAmountX,
      liquidityAmountY
    );

    const txData = {
      needsRebalance: true,
      positionAddress,
      currentRange: {
        lowerBinId: positionData.position.lowerBinId,
        upperBinId: positionData.position.upperBinId,
      },
      newRange,
      transaction: rebalanceResult.transaction,
      newPositionMint: rebalanceResult.positionMint,
      message: "Rebalance transaction prepared. Please sign with your wallet.",
    };

    logger.info("Rebalance transaction prepared", {
      positionAddress,
      newPositionMint: rebalanceResult.positionMint,
    });

    res.json({
      success: true,
      data: txData,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to prepare rebalance", {
      positionAddress: req.body.positionAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to prepare rebalance",
      timestamp: Date.now(),
    });
  }
});

// Execute signed rebalance transaction
router.post("/rebalance/execute", async (req, res) => {
  try {
    const { signedTransaction, positionAddress, newPositionMint } = req.body;
    logger.info("POST /rebalance/execute", {
      positionAddress,
      newPositionMint,
    });

    if (!signedTransaction || !positionAddress || !newPositionMint) {
      return res.status(400).json({
        success: false,
        error:
          "Missing required fields: signedTransaction, positionAddress, newPositionMint",
        timestamp: Date.now(),
      });
    }

    const { getConnection } = await import("./solana/connection");
    const connection = getConnection();

    // Execute single transaction
    const txBuffer = Buffer.from(signedTransaction, "base64");
    const transaction = Transaction.from(txBuffer);

    const signature = await connection.sendRawTransaction(
      transaction.serialize(),
      {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      }
    );

    logger.info("Rebalance transaction sent", { signature, positionAddress });

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(
      signature,
      "confirmed"
    );

    if (confirmation.value.err) {
      throw new Error(
        `Transaction failed: ${JSON.stringify(confirmation.value.err)}`
      );
    }

    logger.info("Rebalance transaction confirmed", {
      signature,
      positionAddress,
    });

    // Store rebalance event
    const positionData = storage.getPosition(positionAddress);
    if (positionData) {
      const rebalanceEvent = {
        id: signature,
        positionAddress,
        timestamp: Date.now(),
        oldRange: {
          lowerBinId: positionData.position.lowerBinId,
          upperBinId: positionData.position.upperBinId,
        },
        newRange: {
          lowerBinId: 0, // Will be updated when new position is loaded
          upperBinId: 0,
        },
        reason: "Manual rebalance",
        signature,
        status: "success" as const,
      };
      storage.addRebalanceEvent(rebalanceEvent);

      // Broadcast rebalance event via WebSocket
      wsServer.broadcastRebalanceEvent(rebalanceEvent);
    }

    res.json({
      success: true,
      data: {
        signature,
        newPositionMint,
        message: "Rebalance executed successfully",
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to execute rebalance", {
      positionAddress: req.body.positionAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to execute rebalance",
      timestamp: Date.now(),
    });
  }
});

router.get("/rebalance/history/:positionAddress?", (req, res) => {
  try {
    const { positionAddress } = req.params;
    logger.info("GET /rebalance/history/:positionAddress?", {
      positionAddress,
    });
    const events = storage.getRebalanceEvents(positionAddress);
    logger.info("Retrieved rebalance history", {
      positionAddress,
      count: events.length,
    });

    res.json({
      success: true,
      data: events,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get rebalance history", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get rebalance history",
      timestamp: Date.now(),
    });
  }
});

// Stop-loss
router.post("/stop-loss/set", (req, res) => {
  try {
    const config = req.body;
    logger.info("POST /stop-loss/set", { config });
    stopLossManager.setStopLoss(config);
    logger.info("Stop-loss configured", {
      positionAddress: config.positionAddress,
    });

    res.json({
      success: true,
      data: { message: "Stop-loss configured" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to set stop-loss", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to set stop-loss",
      timestamp: Date.now(),
    });
  }
});

router.delete("/stop-loss/:positionAddress", (req, res) => {
  try {
    const { positionAddress } = req.params;
    logger.info("DELETE /stop-loss/:positionAddress", { positionAddress });
    stopLossManager.removeStopLoss(positionAddress);
    logger.info("Stop-loss removed", { positionAddress });

    res.json({
      success: true,
      data: { message: "Stop-loss removed" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to remove stop-loss", {
      positionAddress: req.params.positionAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to remove stop-loss",
      timestamp: Date.now(),
    });
  }
});

// Alerts
router.get("/alerts", (req, res) => {
  try {
    const { unread } = req.query;
    logger.info("GET /alerts", { unread });
    const alerts = storage.getAlerts(unread === "true");
    logger.info("Retrieved alerts", { count: alerts.length, unread });

    res.json({
      success: true,
      data: alerts,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get alerts", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get alerts",
      timestamp: Date.now(),
    });
  }
});

router.post("/alerts/:id/read", (req, res) => {
  try {
    const { id } = req.params;
    logger.info("POST /alerts/:id/read", { id });
    storage.markAlertRead(id);
    logger.info("Alert marked as read", { id });

    res.json({
      success: true,
      data: { message: "Alert marked as read" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to mark alert as read", {
      id: req.params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to mark alert as read",
      timestamp: Date.now(),
    });
  }
});

// Eco-mode rebalancing
router.post("/rebalance/eco/start", (req, res) => {
  try {
    const { threshold } = req.body;
    logger.info("POST /rebalance/eco/start", { threshold });

    // Load owner keypair from secure storage
    const ownerKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.WALLET_SECRET_KEY || "[]"))
    );

    ecoRebalancer.startEcoMode(ownerKeypair, threshold || 5);
    logger.info("Eco-mode rebalancing started", { threshold: threshold || 5 });

    res.json({
      success: true,
      data: { message: "Eco-mode rebalancing started" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to start eco-mode", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to start eco-mode",
      timestamp: Date.now(),
    });
  }
});

router.post("/rebalance/eco/stop", (req, res) => {
  try {
    logger.info("POST /rebalance/eco/stop");
    ecoRebalancer.stopEcoMode();
    logger.info("Eco-mode rebalancing stopped");

    res.json({
      success: true,
      data: { message: "Eco-mode rebalancing stopped" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to stop eco-mode", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to stop eco-mode",
      timestamp: Date.now(),
    });
  }
});

router.get("/rebalance/eco/status", (req, res) => {
  try {
    logger.info("GET /rebalance/eco/status");
    const status = ecoRebalancer.getQueueStatus();
    logger.info("Retrieved eco-mode status", { status });

    res.json({
      success: true,
      data: status,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get eco-mode status", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to get eco-mode status",
      timestamp: Date.now(),
    });
  }
});

// Impermanent Loss Calculator
router.post("/analytics/il", (req, res) => {
  try {
    const {
      initialPrice,
      currentPrice,
      initialAmountX,
      initialAmountY,
      feesEarned,
    } = req.body;
    logger.info("POST /analytics/il", {
      initialPrice,
      currentPrice,
      initialAmountX,
      initialAmountY,
      feesEarned,
    });

    const result = ilCalculator.calculateDetailedIL(
      initialPrice,
      currentPrice,
      initialAmountX,
      initialAmountY,
      feesEarned || 0
    );
    logger.info("Calculated IL", { result });

    res.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to calculate IL", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to calculate IL",
      timestamp: Date.now(),
    });
  }
});

router.get("/analytics/il/scenarios/:initialPrice", (req, res) => {
  try {
    const { initialPrice } = req.params;
    logger.info("GET /analytics/il/scenarios/:initialPrice", { initialPrice });
    const scenarios = ilCalculator.calculateILScenarios(
      parseFloat(initialPrice)
    );
    logger.info("Calculated IL scenarios", { scenarioCount: scenarios.size });

    res.json({
      success: true,
      data: Object.fromEntries(scenarios),
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to calculate IL scenarios", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to calculate IL scenarios",
      timestamp: Date.now(),
    });
  }
});

// Fee Tier Optimization
router.post("/analytics/fee-optimization", async (req, res) => {
  try {
    const { poolAddress } = req.body;
    logger.info("POST /analytics/fee-optimization", { poolAddress });

    const pool = await dlmmClient.getPoolInfo(new PublicKey(poolAddress));
    const volatilityData = volatilityTracker.getVolatilityData(poolAddress);
    const volatility = volatilityData?.volatility || 50;

    const optimization = feeOptimizer.optimizeFeeTier(
      pool,
      volatility,
      pool.volume24h
    );
    const comparison = feeOptimizer.compareFeeTiers(
      pool,
      volatility,
      pool.volume24h
    );
    logger.info("Optimized fee tier", {
      poolAddress,
      recommended: optimization.recommendedTier,
    });

    res.json({
      success: true,
      data: {
        recommended: optimization,
        comparison,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to optimize fee tier", {
      poolAddress: req.body.poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to optimize fee tier",
      timestamp: Date.now(),
    });
  }
});

// DLMM SDK Methods
router.get("/pools", async (req, res) => {
  try {
    logger.info("GET /pools");
    const poolAddresses = await dlmmClient.getPoolAddresses();
    logger.info("Retrieved pool addresses", { count: poolAddresses.length });

    // Fetch detailed info for first 20 pools (try more to get at least 10 valid ones)
    const pools = [];
    let attempted = 0;
    const maxAttempts = 30;

    for (const address of poolAddresses) {
      if (pools.length >= 10 || attempted >= maxAttempts) break;
      attempted++;

      try {
        logger.debug("Fetching pool info", { address, attempt: attempted });
        const pool = await dlmmClient.getPoolInfo(new PublicKey(address));
        pools.push(pool);
        logger.debug("Pool info fetched successfully", {
          address,
          poolsCount: pools.length,
        });
      } catch (err) {
        logger.warn("Failed to fetch pool info", {
          address,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info("Pools fetched for response", { totalPools: pools.length });

    res.json({
      success: true,
      data: pools,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get pools", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get pools",
      timestamp: Date.now(),
    });
  }
});

router.get("/pool/:address", async (req, res) => {
  try {
    const { address } = req.params;
    logger.info("GET /pool/:address", { address });
    const pool = await dlmmClient.getPoolInfo(new PublicKey(address));
    logger.info("Retrieved pool info", {
      address,
      tokenX: pool.tokenX.symbol,
      tokenY: pool.tokenY.symbol,
    });

    res.json({
      success: true,
      data: pool,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get pool info", {
      address: req.params.address,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get pool info",
      timestamp: Date.now(),
    });
  }
});

router.get("/pool/:address/bins", async (req, res) => {
  try {
    const { address } = req.params;
    logger.info("GET /pool/:address/bins", { address });
    const bins = await dlmmClient.getBinArrays(new PublicKey(address));
    logger.info("Retrieved bin arrays", { address, binCount: bins.length });

    res.json({
      success: true,
      data: bins,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get bin arrays", {
      address: req.params.address,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get bin arrays",
      timestamp: Date.now(),
    });
  }
});

router.get("/pool/:address/active-bin", async (req, res) => {
  try {
    const { address } = req.params;
    logger.info("GET /pool/:address/active-bin", { address });
    const activeBin = await dlmmClient.getActiveBin(new PublicKey(address));
    logger.info("Retrieved active bin", { address, binId: activeBin.binId });

    res.json({
      success: true,
      data: activeBin,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get active bin", {
      address: req.params.address,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to get active bin",
      timestamp: Date.now(),
    });
  }
});

router.post("/pool/:address/quote", async (req, res) => {
  try {
    const { address } = req.params;
    const { amountIn, swapForY } = req.body;
    logger.info("POST /pool/:address/quote", { address, amountIn, swapForY });

    const quote = await dlmmClient.getQuote(
      new PublicKey(address),
      amountIn,
      swapForY
    );
    logger.info("Retrieved quote", { address, amountOut: quote.amountOut });

    res.json({
      success: true,
      data: quote,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get quote", {
      address: req.params.address,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get quote",
      timestamp: Date.now(),
    });
  }
});

// Position Creation
router.post("/positions/create", async (req, res) => {
  try {
    const { poolAddress, lowerPrice, upperPrice, amountX, amountY, wallet } =
      req.body;
    logger.info("POST /positions/create", {
      poolAddress,
      lowerPrice,
      upperPrice,
      amountX,
      amountY,
      wallet,
    });

    if (
      !poolAddress ||
      !lowerPrice ||
      !upperPrice ||
      !amountX ||
      !amountY ||
      !wallet
    ) {
      logger.warn("Missing required fields for position creation");
      return res.status(400).json({
        success: false,
        error: "Missing required fields",
        timestamp: Date.now(),
      });
    }

    const pool = await dlmmClient.getPoolInfo(new PublicKey(poolAddress));
    const binStep = pool.binStep;
    const activeBinId = pool.activeId;
    const currentPrice = pool.currentPrice;

    logger.info("Pool info for position creation", {
      poolAddress,
      binStep,
      activeBinId,
      currentPrice,
      requestedLowerPrice: lowerPrice,
      requestedUpperPrice: upperPrice,
    });

    // Convert prices to bin IDs using the correct DLMM formula
    // DLMM uses reference bin ID 8388608 (2^23) where price = 1
    // binId = floor(log(price) / log(1 + binStep/10000)) + REFERENCE_BIN_ID
    const REFERENCE_BIN_ID = 8388608;
    const binStepNum = binStep / 10000;
    const lowerBinId =
      Math.floor(Math.log(parseFloat(lowerPrice)) / Math.log(1 + binStepNum)) +
      REFERENCE_BIN_ID;
    const upperBinId =
      Math.floor(Math.log(parseFloat(upperPrice)) / Math.log(1 + binStepNum)) +
      REFERENCE_BIN_ID;

    // Calculate relative bin IDs for validation
    const relativeLower = lowerBinId - activeBinId;
    const relativeUpper = upperBinId - activeBinId;

    logger.info("Calculated bin IDs", {
      lowerBinId,
      upperBinId,
      activeBinId,
      relativeLower,
      relativeUpper,
      binRange: upperBinId - lowerBinId,
    });

    // Validate bin range
    if (lowerBinId >= upperBinId) {
      logger.warn("Invalid bin range: lower >= upper", {
        lowerBinId,
        upperBinId,
        lowerPrice,
        upperPrice,
      });
      return res.status(400).json({
        success: false,
        error: `Invalid price range: lower price (${lowerPrice}) must be less than upper price (${upperPrice})`,
        timestamp: Date.now(),
      });
    }

    // Check if range is too wide (max 140 bins)
    const binRange = upperBinId - lowerBinId;
    if (binRange > 140) {
      logger.warn("Bin range too wide", { binRange, lowerBinId, upperBinId });
      return res.status(400).json({
        success: false,
        error: `Price range too wide. Please narrow your range. (Current: ${binRange} bins, Max: 140 bins)`,
        timestamp: Date.now(),
      });
    }

    // Validate relative positions are within bounds
    if (Math.abs(relativeLower) > 1000 || Math.abs(relativeUpper) > 1000) {
      logger.warn("Position too far from active bin", {
        relativeLower,
        relativeUpper,
        activeBinId,
      });
      return res.status(400).json({
        success: false,
        error: `Price range too far from current price. Please set prices closer to $${currentPrice.toFixed(4)}`,
        timestamp: Date.now(),
      });
    }

    logger.info("Preparing position creation transaction", {
      poolAddress,
      lowerBinId,
      upperBinId,
    });

    // Return unsigned transaction for client to sign
    const txData = await dlmmClient.prepareCreatePositionTransaction(
      new PublicKey(poolAddress),
      lowerBinId,
      upperBinId,
      (amountX * Math.pow(10, pool.tokenX.decimals)).toString(),
      (amountY * Math.pow(10, pool.tokenY.decimals)).toString(),
      new PublicKey(wallet)
    );

    logger.info("Position creation transaction prepared", { poolAddress });

    res.json({
      success: true,
      data: txData,
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to create position", {
      poolAddress: req.body.poolAddress,
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to create position",
      timestamp: Date.now(),
    });
  }
});

// Telegram Configuration
router.post("/telegram/configure", (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    logger.info("POST /telegram/configure", { chatId });
    telegramBot.configure(botToken, chatId);
    logger.info("Telegram bot configured", { chatId });

    res.json({
      success: true,
      data: { message: "Telegram bot configured" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to configure Telegram", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to configure Telegram",
      timestamp: Date.now(),
    });
  }
});

router.post("/telegram/disable", (req, res) => {
  try {
    logger.info("POST /telegram/disable");
    telegramBot.disable();
    logger.info("Telegram bot disabled");

    res.json({
      success: true,
      data: { message: "Telegram bot disabled" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to disable Telegram", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to disable Telegram",
      timestamp: Date.now(),
    });
  }
});

// Telegram Test Endpoint
router.post("/telegram/test", async (req, res) => {
  try {
    logger.info("POST /telegram/test");

    await telegramBot.sendAlert({
      id: `test-${Date.now()}`,
      type: "info",
      title: "Test Alert",
      message:
        "This is a test message from your Saros DLMM bot! 🚀\n\nIf you received this, your Telegram integration is working correctly.",
      timestamp: Date.now(),
      read: false,
    });

    logger.info("Test message sent to Telegram");

    res.json({
      success: true,
      data: { message: "Test message sent to Telegram" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to send test message", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to send test message",
      timestamp: Date.now(),
    });
  }
});

// Settings
router.get("/settings", (req, res) => {
  try {
    logger.info("GET /settings");
    const settings = storage.getSettings();
    logger.info("Retrieved settings", { settings });

    res.json({
      success: true,
      data: settings || {},
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get settings", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get settings",
      timestamp: Date.now(),
    });
  }
});

router.post("/settings", (req, res) => {
  try {
    const settings = req.body;
    logger.info("POST /settings", { settings });
    storage.saveSettings(settings);
    logger.info("Settings saved successfully");

    res.json({
      success: true,
      data: { message: "Settings saved successfully" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to save settings", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to save settings",
      timestamp: Date.now(),
    });
  }
});

// Auto-Rebalancing Control
router.post("/automation/rebalance/start", (req, res) => {
  try {
    const { wallet, threshold } = req.body;
    logger.info("POST /automation/rebalance/start", { wallet, threshold });

    if (!wallet) {
      return res.status(400).json({
        success: false,
        error: "Wallet address is required",
        timestamp: Date.now(),
      });
    }

    // Store automation settings
    const settings = storage.getSettings() || {};
    storage.saveSettings({
      ...settings,
      autoRebalance: true,
      rebalanceThreshold: threshold || 5,
      monitoredWallet: wallet,
    });

    // Start position monitoring for the wallet
    positionMonitor.startMonitoring([wallet]);
    positionMonitor.startAutoRebalancing(threshold || 5);
    logger.info("Position monitoring and auto-rebalancing started", {
      wallet,
      threshold: threshold || 5,
    });

    // Broadcast auto-rebalance status via WebSocket
    wsServer.broadcastAutoRebalanceStatus({
      enabled: true,
      threshold: threshold || 5,
      lastCheck: Date.now(),
    });

    res.json({
      success: true,
      data: {
        message: "Auto-rebalancing started",
        wallet,
        threshold: threshold || 5,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to start auto-rebalancing", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to start auto-rebalancing",
      timestamp: Date.now(),
    });
  }
});

router.post("/automation/rebalance/stop", (req, res) => {
  try {
    logger.info("POST /automation/rebalance/stop");

    // Update settings
    const settings = storage.getSettings() || {};
    storage.saveSettings({
      ...settings,
      autoRebalance: false,
    });

    // Stop monitoring
    positionMonitor.stopMonitoring();
    rebalancer.stopAutoRebalancing();
    logger.info("Auto-rebalancing stopped");

    // Broadcast auto-rebalance status via WebSocket
    wsServer.broadcastAutoRebalanceStatus({
      enabled: false,
      threshold: settings.rebalanceThreshold || 5,
    });

    res.json({
      success: true,
      data: { message: "Auto-rebalancing stopped" },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to stop auto-rebalancing", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Failed to stop auto-rebalancing",
      timestamp: Date.now(),
    });
  }
});

router.get("/automation/rebalance/status", (req, res) => {
  try {
    logger.info("GET /automation/rebalance/status");
    const settings = storage.getSettings() || {};

    res.json({
      success: true,
      data: {
        enabled: settings.autoRebalance || false,
        threshold: settings.rebalanceThreshold || 5,
        wallet: settings.monitoredWallet || null,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    logger.error("Failed to get auto-rebalancing status", {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to get status",
      timestamp: Date.now(),
    });
  }
});

export default router;
