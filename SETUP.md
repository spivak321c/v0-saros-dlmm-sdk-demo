# Setup Guide

Complete guide to setting up and running the Saros DLMM Rebalancer.

## Prerequisites

- Node.js 18+ and npm
- Solana CLI tools
- Telegram account
- Git

## Step 1: Clone Repository

\`\`\`bash
git clone https://github.com/yourusername/saros-dlmm-rebalancer.git
cd saros-dlmm-rebalancer
\`\`\`

## Step 2: Install Dependencies

\`\`\`bash
npm install
\`\`\`

## Step 3: Setup Solana Wallet

### Create New Wallet

\`\`\`bash
solana-keygen new --outfile ~/.config/solana/devnet.json
\`\`\`

### Get Devnet SOL

\`\`\`bash
solana airdrop 2 --url devnet
\`\`\`

### Export Private Key

\`\`\`bash
# Get private key in base58 format
solana-keygen pubkey ~/.config/solana/devnet.json
cat ~/.config/solana/devnet.json
\`\`\`

## Step 4: Create Telegram Bot

1. Open Telegram and search for @BotFather
2. Send `/newbot` command
3. Follow prompts to create your bot
4. Copy the bot token (looks like: `123456789:ABCdefGHIjklMNOpqrsTUVwxyz`)

### Get Chat ID

1. Start a chat with your bot
2. Send any message
3. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
4. Find your chat ID in the response

## Step 5: Configure Environment

Create `.env` file:

\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` with your values:

\`\`\`env
# Solana Configuration
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_NETWORK=devnet

# Wallet (use base58 format from Step 3)
WALLET_PRIVATE_KEY=your_base58_private_key_here

# Telegram (from Step 4)
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_CHAT_ID=your_chat_id_here

# Rebalancer Settings
REBALANCE_INTERVAL_MINUTES=15
VOLATILITY_THRESHOLD=0.05
OUT_OF_RANGE_THRESHOLD=0.1
MIN_FEE_THRESHOLD=0.001

# Pool Addresses (devnet DLMM pools)
MONITORED_POOLS=7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU,8xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsV

# Stop Loss
ENABLE_STOP_LOSS=true
STOP_LOSS_PERCENTAGE=0.15

# Analytics
NEXT_PUBLIC_API_URL=http://localhost:3000/api
PORT=3000
\`\`\`

## Step 6: Create Test Positions

### Option A: Using Saros UI

1. Visit [Saros Finance Devnet](https://devnet.saros.finance)
2. Connect your wallet
3. Add liquidity to DLMM pools
4. Note the pool addresses

### Option B: Using SDK (Advanced)

\`\`\`typescript
// Create position programmatically
import { DLMMPool, addLiquidityIntoPosition } from '@saros-finance/dlmm-sdk';

const pool = await DLMMPool.load(connection, poolAddress);
await addLiquidityIntoPosition(connection, wallet, pool, {
  lowerBin: 8000,
  upperBin: 8200,
  amountX: new BN(1000000000),
  amountY: new BN(1000000000),
});
\`\`\`

## Step 7: Test Components

### Test Rebalancer

\`\`\`bash
npm run rebalancer
\`\`\`

Expected output:
\`\`\`
[INFO] Starting Auto Rebalancer
[INFO] Running rebalance check...
[INFO] Checking 3 positions
[SUCCESS] Rebalance check completed
\`\`\`

### Test Telegram Bot

\`\`\`bash
npm run bot
\`\`\`

In Telegram, send `/start` to your bot. You should receive a welcome message.

### Test Simulator

\`\`\`bash
npm run simulator
\`\`\`

Expected output:
\`\`\`
[INFO] Starting Strategy Simulation
[INFO] SIMULATION RESULTS (30-day period)
[SUCCESS] Best Strategy: Volatility-Adjusted (Recommended)
\`\`\`

### Test Dashboard

\`\`\`bash
npm run dev
\`\`\`

Visit `http://localhost:3000` to see the analytics dashboard.

## Step 8: Deploy to Production

### Deploy Rebalancer (Heroku)

\`\`\`bash
# Install Heroku CLI
npm install -g heroku

# Login
heroku login

# Create app
heroku create saros-rebalancer

# Set environment variables
heroku config:set WALLET_PRIVATE_KEY=xxx
heroku config:set TELEGRAM_BOT_TOKEN=xxx
heroku config:set TELEGRAM_CHAT_ID=xxx
heroku config:set MONITORED_POOLS=xxx

# Deploy
git push heroku main

# Start worker
heroku ps:scale worker=1

# View logs
heroku logs --tail
\`\`\`

### Deploy Dashboard (Vercel)

\`\`\`bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
vercel --prod

# Set environment variables in Vercel dashboard
\`\`\`

## Troubleshooting

### Issue: "Invalid wallet private key format"

**Solution**: Ensure you're using base58 format. Convert from JSON array:

\`\`\`bash
# If you have JSON array format
node -e "console.log(require('bs58').encode(Buffer.from(JSON.parse(require('fs').readFileSync('.config/solana/devnet.json')))))"
\`\`\`

### Issue: "No positions found"

**Solution**: 
1. Verify you have liquidity in DLMM pools
2. Check pool addresses in `.env` match your positions
3. Ensure wallet address is correct

### Issue: "Telegram bot not responding"

**Solution**:
1. Verify bot token is correct
2. Ensure you've started a chat with the bot
3. Check chat ID matches your user ID

### Issue: "RPC rate limit exceeded"

**Solution**: Use a private RPC endpoint:

\`\`\`env
SOLANA_RPC_URL=https://your-private-rpc-endpoint.com
\`\`\`

## Next Steps

1. Monitor positions via Telegram bot
2. View analytics on dashboard
3. Run simulations to optimize strategy
4. Adjust rebalancing parameters based on results
5. Scale to mainnet (update RPC and pool addresses)

## Support

- GitHub Issues: [Report bugs](https://github.com/yourusername/saros-dlmm-rebalancer/issues)
- Saros Docs: [https://saros-docs.rectorspace.com](https://saros-docs.rectorspace.com)
- Telegram: Join Saros community

## Security Notes

- Never commit `.env` file
- Use environment variables for production
- Rotate keys regularly
- Test on devnet before mainnet
- Monitor gas costs and adjust thresholds
\`\`\`

## Video Demo Script

Record a 3-5 minute demo covering:

1. **Introduction** (30s)
   - Show dashboard overview
   - Explain problem: manual LP rebalancing is tedious

2. **Core Features** (2m)
   - Show positions in dashboard
   - Demonstrate Telegram bot commands
   - Explain volatility-adjusted ranges
   - Show rebalancing in action

3. **Unique Innovations** (1m)
   - Volatility calculation from bin data
   - Dynamic range adjustment
   - Stop-loss protection
   - Strategy simulator results

4. **Technical Highlights** (1m)
   - DLMM SDK integration
   - Multi-pool monitoring
   - Real-time alerts
   - Portfolio analytics

5. **Conclusion** (30s)
   - Hackathon submission
   - Open source (MIT)
   - Future roadmap (AI predictions)
