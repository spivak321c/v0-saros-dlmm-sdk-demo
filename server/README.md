# Saros DLMM Liquidity Provider Dashboard - Server

Complete backend implementation for managing DLMM liquidity positions with automated rebalancing, risk management, and analytics.

## Features Implemented

### 1. **Full Saros DLMM SDK Integration**
- ✅ `createPosition` - Create new liquidity positions
- ✅ `addLiquidity` - Add liquidity to existing positions
- ✅ `removeLiquidity` - Remove liquidity from positions
- ✅ `getUserPositions` - Fetch all user positions
- ✅ `getBinArrays` - Get bin array data for pools
- ✅ `getActiveBin` - Get current active bin
- ✅ `getQuote` - Get swap quotes
- ✅ `collectFees` - Claim fees and rewards

### 2. **Impermanent Loss Calculator**
Formula: `IL = 2√r / (1 + r) - 1` where r = price_ratio

- Calculate IL percentage
- Detailed IL with HODL comparison
- IL scenarios for different price movements
- Break-even fee APR calculation
- Risk level assessment (low/medium/high/critical)

### 3. **Fee Tier Optimization**
Automatic fee tier selection based on volatility:
- **STABLE (0.01%)** - Volatility < 5%
- **LOW (0.05%)** - Volatility < 20%
- **MEDIUM (0.25%)** - Volatility < 50%
- **HIGH (1.00%)** - Volatility ≥ 50%

Features:
- APR estimation for each tier
- Fee tier comparison
- Volatility-based recommendations

### 4. **Eco-Mode Rebalancing**
Batched rebalancing to minimize transaction costs:
- Priority-based queue (0-100 score)
- Batch execution (max 5 positions per batch)
- Minimum priority threshold (50)
- Gas savings estimation (~20% per batched tx)
- Hourly batch processing

Priority Calculation:
- Out of range: +50 points
- Distance from price: +30 points
- Impermanent loss severity: +20 points

### 5. **Automated Rebalancing**
- Continuous position monitoring
- Out-of-range detection
- Volatility-based range adjustment
- Automatic liquidity migration
- Configurable threshold (default 5%)

### 6. **Stop-Loss Management**
- Total loss threshold monitoring
- Impermanent loss threshold monitoring
- Automatic position closure
- Alert notifications

### 7. **Telegram Notifications**
- Rebalance alerts (success/failure)
- Stop-loss triggers
- Position out-of-range warnings
- High IL alerts
- Daily summary reports

### 8. **Volatility Tracking**
- Real-time volatility calculation
- 24h and 7d price change tracking
- Volume monitoring
- Annualized volatility metrics

## API Endpoints

### Positions
```
GET  /api/positions/:wallet              - Get all positions for wallet
GET  /api/positions/detail/:address      - Get detailed position info
```

### Volatility
```
GET  /api/volatility/:poolAddress        - Get volatility data for pool
```

### Rebalancing
```
POST /api/rebalance                      - Manual rebalance
GET  /api/rebalance/history/:address?    - Get rebalance history
POST /api/rebalance/eco/start            - Start eco-mode
POST /api/rebalance/eco/stop             - Stop eco-mode
GET  /api/rebalance/eco/status           - Get eco-mode queue status
```

### Stop-Loss
```
POST   /api/stop-loss/set                - Configure stop-loss
DELETE /api/stop-loss/:positionAddress   - Remove stop-loss
```

### Analytics
```
POST /api/analytics/il                   - Calculate detailed IL
GET  /api/analytics/il/scenarios/:price  - Get IL scenarios
POST /api/analytics/fee-optimization     - Get fee tier recommendations
```

### Pool Data (DLMM SDK)
```
GET  /api/pool/:address                  - Get pool info
GET  /api/pool/:address/bins             - Get bin arrays
GET  /api/pool/:address/active-bin       - Get active bin
POST /api/pool/:address/quote            - Get swap quote
```

### Telegram
```
POST /api/telegram/configure             - Configure Telegram bot
POST /api/telegram/disable               - Disable Telegram notifications
```

### Alerts
```
GET  /api/alerts?unread=true             - Get alerts
POST /api/alerts/:id/read                - Mark alert as read
```

## Configuration

### Environment Variables
```env
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
PORT=3000
```

### Telegram Setup
```typescript
// Configure via API
POST /api/telegram/configure
{
  "botToken": "YOUR_BOT_TOKEN",
  "chatId": "YOUR_CHAT_ID"
}
```

## Usage Examples

### 1. Start Eco-Mode Rebalancing
```typescript
POST /api/rebalance/eco/start
{
  "owner": "WALLET_PUBLIC_KEY",
  "threshold": 5  // Rebalance when within 5% of range boundary
}
```

### 2. Calculate Impermanent Loss
```typescript
POST /api/analytics/il
{
  "initialPrice": 100,
  "currentPrice": 150,
  "initialAmountX": 1000,
  "initialAmountY": 100000,
  "feesEarned": 500
}

Response:
{
  "impermanentLoss": -2.02,  // 2.02% loss
  "hodlValue": 250000,
  "lpValue": 245000,
  "absoluteLoss": -5000
}
```

### 3. Get Fee Tier Recommendation
```typescript
POST /api/analytics/fee-optimization
{
  "poolAddress": "POOL_PUBLIC_KEY"
}

Response:
{
  "recommended": {
    "recommendedTier": 25,  // MEDIUM
    "reason": "Standard volatility - typical trading pair",
    "expectedApr": 45.2
  },
  "comparison": {
    "1": { "expectedApr": 5.1 },
    "5": { "expectedApr": 25.5 },
    "25": { "expectedApr": 45.2 },
    "100": { "expectedApr": 180.8 }
  }
}
```

### 4. Set Stop-Loss
```typescript
POST /api/stop-loss/set
{
  "positionAddress": "POSITION_PUBLIC_KEY",
  "enabled": true,
  "lossThreshold": 10,           // Close if 10% total loss
  "impermanentLossThreshold": 5  // Close if 5% IL
}
```

## Architecture

### Services
- **DLMMClient** - Saros SDK wrapper with all core methods
- **PositionMonitor** - Tracks position data and metrics
- **Rebalancer** - Standard rebalancing logic
- **EcoRebalancer** - Batched rebalancing with priority queue
- **VolatilityTracker** - Calculates and tracks volatility
- **StopLossManager** - Monitors and executes stop-loss
- **TelegramBot** - Sends notifications

### Utilities
- **ILCalculator** - Impermanent loss calculations
- **FeeOptimizer** - Fee tier optimization logic

### Storage
In-memory storage (replace with database for production):
- Positions
- Price history
- Volatility data
- Rebalance events
- Alerts
- Initial prices (for IL calculation)

## Implementation Notes

### Rebalancing Strategy
1. Monitor positions every 5 minutes (standard) or 1 hour (eco-mode)
2. Check if position is out-of-range or approaching boundary
3. Calculate optimal new range based on volatility
4. Remove liquidity from old position
5. Create new position with adjusted range
6. Send Telegram notification

### Volatility-Based Range Adjustment
```
width = baseWidth * (1 + volatility / 100)
```
- Higher volatility → wider range → fewer rebalances
- Lower volatility → tighter range → better capital efficiency

### Eco-Mode Benefits
- Reduces transaction costs by batching
- Priority-based execution (most urgent first)
- Configurable batch size and interval
- Gas savings estimation

## Next Steps

### Optional Enhancements
1. **AMM Integration** - Add `@saros-finance/sdk` for AMM swaps during stop-loss
2. **Staking Integration** - Stake positions for additional yields
3. **Database** - Replace in-memory storage with PostgreSQL/MongoDB
4. **Authentication** - Add wallet signature verification
5. **Rate Limiting** - Implement API rate limits
6. **Caching** - Add Redis for pool/position data
7. **Historical Analytics** - Track performance over time
8. **Multi-wallet Support** - Manage multiple wallets

## Security Considerations

⚠️ **Important**: This implementation requires wallet private keys for transaction signing. In production:
- Use secure key management (HSM, KMS)
- Implement wallet signature verification
- Add transaction simulation before execution
- Set up monitoring and alerting
- Use environment-specific RPC endpoints
- Implement proper error handling and retry logic

## License

MIT
