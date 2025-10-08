import { Router } from 'express';
import { PublicKey, Keypair } from '@solana/web3.js';
import { positionMonitor } from './services/position-monitor';
import { volatilityTracker } from './services/volatility-tracker';
import { rebalancer } from './services/rebalancer';
import { ecoRebalancer } from './services/eco-rebalancer';
import { stopLossManager } from './services/stop-loss-manager';
import { telegramBot } from './services/telegram-bot';
import { dlmmClient } from './solana/dlmm-client';
import { ilCalculator } from './utils/il-calculator';
import { feeOptimizer } from './utils/fee-optimizer';
import { storage } from './storage';
import type { ApiResponse } from '../shared/schema';

const router = Router();

// Positions
router.get('/positions/:wallet', async (req, res) => {
  try {
    const { wallet } = req.params;
    const positions = await positionMonitor.loadUserPositions(wallet);
    
    const response: ApiResponse<typeof positions> = {
      success: true,
      data: positions,
      timestamp: Date.now(),
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load positions',
      timestamp: Date.now(),
    });
  }
});

router.get('/positions/detail/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const position = await positionMonitor.loadPositionData(address);
    
    const response: ApiResponse<typeof position> = {
      success: true,
      data: position || undefined,
      timestamp: Date.now(),
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load position',
      timestamp: Date.now(),
    });
  }
});

// Volatility
router.get('/volatility/:poolAddress', async (req, res) => {
  try {
    const { poolAddress } = req.params;
    const volatilityData = await volatilityTracker.updateVolatilityData(poolAddress);
    
    const response: ApiResponse<typeof volatilityData> = {
      success: true,
      data: volatilityData,
      timestamp: Date.now(),
    };
    
    res.json(response);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get volatility data',
      timestamp: Date.now(),
    });
  }
});

// Rebalancing
router.post('/rebalance', async (req, res) => {
  try {
    const { positionAddress, owner } = req.body;
    
    const shouldRebal = await rebalancer.shouldRebalance(positionAddress);
    
    if (!shouldRebal) {
      return res.json({
        success: true,
        data: { message: 'Position does not need rebalancing' },
        timestamp: Date.now(),
      });
    }

    const positionData = storage.getPosition(positionAddress);
    if (!positionData) {
      throw new Error('Position not found');
    }

    const volatilityData = volatilityTracker.getVolatilityData(positionData.pool.address);
    const volatility = volatilityData?.volatility || 50;

    const newRange = rebalancer.calculateOptimalRange(
      positionData.pool.address,
      positionData.pool.activeId,
      volatility
    );

    // Load wallet keypair from environment
    const privateKeyString = process.env.WALLET_PRIVATE_KEY;
    if (!privateKeyString) {
      throw new Error('WALLET_PRIVATE_KEY not configured');
    }
    
    const ownerKeypair = Keypair.fromSecretKey(
      Buffer.from(privateKeyString, 'base64')
    );

    const event = await rebalancer.executeRebalance(
      {
        positionAddress,
        newLowerBinId: newRange.lowerBinId,
        newUpperBinId: newRange.upperBinId,
        reason: 'Manual rebalance',
      },
      ownerKeypair
    );

    res.json({
      success: true,
      data: event,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to rebalance',
      timestamp: Date.now(),
    });
  }
});

router.get('/rebalance/history/:positionAddress?', (req, res) => {
  try {
    const { positionAddress } = req.params;
    const events = storage.getRebalanceEvents(positionAddress);
    
    res.json({
      success: true,
      data: events,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get rebalance history',
      timestamp: Date.now(),
    });
  }
});

// Stop-loss
router.post('/stop-loss/set', (req, res) => {
  try {
    const config = req.body;
    stopLossManager.setStopLoss(config);
    
    res.json({
      success: true,
      data: { message: 'Stop-loss configured' },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set stop-loss',
      timestamp: Date.now(),
    });
  }
});

router.delete('/stop-loss/:positionAddress', (req, res) => {
  try {
    const { positionAddress } = req.params;
    stopLossManager.removeStopLoss(positionAddress);
    
    res.json({
      success: true,
      data: { message: 'Stop-loss removed' },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to remove stop-loss',
      timestamp: Date.now(),
    });
  }
});

// Alerts
router.get('/alerts', (req, res) => {
  try {
    const { unread } = req.query;
    const alerts = storage.getAlerts(unread === 'true');
    
    res.json({
      success: true,
      data: alerts,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get alerts',
      timestamp: Date.now(),
    });
  }
});

router.post('/alerts/:id/read', (req, res) => {
  try {
    const { id } = req.params;
    storage.markAlertRead(id);
    
    res.json({
      success: true,
      data: { message: 'Alert marked as read' },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to mark alert as read',
      timestamp: Date.now(),
    });
  }
});

// Eco-mode rebalancing
router.post('/rebalance/eco/start', (req, res) => {
  try {
    const { threshold } = req.body;
    
    // Load owner keypair from secure storage
    const ownerKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(process.env.WALLET_SECRET_KEY || '[]'))
    );
    
    ecoRebalancer.startEcoMode(ownerKeypair, threshold || 5);
    
    res.json({
      success: true,
      data: { message: 'Eco-mode rebalancing started' },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start eco-mode',
      timestamp: Date.now(),
    });
  }
});

router.post('/rebalance/eco/stop', (req, res) => {
  try {
    ecoRebalancer.stopEcoMode();
    
    res.json({
      success: true,
      data: { message: 'Eco-mode rebalancing stopped' },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop eco-mode',
      timestamp: Date.now(),
    });
  }
});

router.get('/rebalance/eco/status', (req, res) => {
  try {
    const status = ecoRebalancer.getQueueStatus();
    
    res.json({
      success: true,
      data: status,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get eco-mode status',
      timestamp: Date.now(),
    });
  }
});

// Impermanent Loss Calculator
router.post('/analytics/il', (req, res) => {
  try {
    const { initialPrice, currentPrice, initialAmountX, initialAmountY, feesEarned } = req.body;
    
    const result = ilCalculator.calculateDetailedIL(
      initialPrice,
      currentPrice,
      initialAmountX,
      initialAmountY,
      feesEarned || 0
    );
    
    res.json({
      success: true,
      data: result,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate IL',
      timestamp: Date.now(),
    });
  }
});

router.get('/analytics/il/scenarios/:initialPrice', (req, res) => {
  try {
    const { initialPrice } = req.params;
    const scenarios = ilCalculator.calculateILScenarios(parseFloat(initialPrice));
    
    res.json({
      success: true,
      data: Object.fromEntries(scenarios),
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to calculate IL scenarios',
      timestamp: Date.now(),
    });
  }
});

// Fee Tier Optimization
router.post('/analytics/fee-optimization', async (req, res) => {
  try {
    const { poolAddress } = req.body;
    
    const pool = await dlmmClient.getPoolInfo(new PublicKey(poolAddress));
    const volatilityData = volatilityTracker.getVolatilityData(poolAddress);
    const volatility = volatilityData?.volatility || 50;
    
    const optimization = feeOptimizer.optimizeFeeTier(pool, volatility, pool.volume24h);
    const comparison = feeOptimizer.compareFeeTiers(pool, volatility, pool.volume24h);
    
    res.json({
      success: true,
      data: {
        recommended: optimization,
        comparison,
      },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to optimize fee tier',
      timestamp: Date.now(),
    });
  }
});

// DLMM SDK Methods
router.get('/pool/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const pool = await dlmmClient.getPoolInfo(new PublicKey(address));
    
    res.json({
      success: true,
      data: pool,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get pool info',
      timestamp: Date.now(),
    });
  }
});

router.get('/pool/:address/bins', async (req, res) => {
  try {
    const { address } = req.params;
    const bins = await dlmmClient.getBinArrays(new PublicKey(address));
    
    res.json({
      success: true,
      data: bins,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get bin arrays',
      timestamp: Date.now(),
    });
  }
});

router.get('/pool/:address/active-bin', async (req, res) => {
  try {
    const { address } = req.params;
    const activeBin = await dlmmClient.getActiveBin(new PublicKey(address));
    
    res.json({
      success: true,
      data: activeBin,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get active bin',
      timestamp: Date.now(),
    });
  }
});

router.post('/pool/:address/quote', async (req, res) => {
  try {
    const { address } = req.params;
    const { amountIn, swapForY } = req.body;
    
    const quote = await dlmmClient.getQuote(
      new PublicKey(address),
      amountIn,
      swapForY
    );
    
    res.json({
      success: true,
      data: quote,
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get quote',
      timestamp: Date.now(),
    });
  }
});

// Telegram Configuration
router.post('/telegram/configure', (req, res) => {
  try {
    const { botToken, chatId } = req.body;
    telegramBot.configure(botToken, chatId);
    
    res.json({
      success: true,
      data: { message: 'Telegram bot configured' },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to configure Telegram',
      timestamp: Date.now(),
    });
  }
});

router.post('/telegram/disable', (req, res) => {
  try {
    telegramBot.disable();
    
    res.json({
      success: true,
      data: { message: 'Telegram bot disabled' },
      timestamp: Date.now(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to disable Telegram',
      timestamp: Date.now(),
    });
  }
});

export default router;
