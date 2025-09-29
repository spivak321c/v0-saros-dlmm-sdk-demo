# Deployment Guide

Complete guide for deploying the Saros DLMM Rebalancer to production.

## Architecture Overview

\`\`\`
┌─────────────────┐
│  Vercel         │
│  (Dashboard)    │
└────────┬────────┘
         │
         │ API Calls
         │
┌────────▼────────┐      ┌──────────────┐
│  Heroku         │◄─────┤  Telegram    │
│  (Rebalancer)   │      │  Bot         │
└────────┬────────┘      └──────────────┘
         │
         │ RPC Calls
         │
┌────────▼────────┐
│  Solana         │
│  (Devnet/Main)  │
└─────────────────┘
\`\`\`

## Prerequisites

- Heroku account (for rebalancer service)
- Vercel account (for dashboard)
- Private Solana RPC endpoint (recommended for production)
- Domain name (optional)

## Part 1: Deploy Rebalancer Service

### Option A: Heroku

1. **Install Heroku CLI**

\`\`\`bash
npm install -g heroku
heroku login
\`\`\`

2. **Create Heroku App**

\`\`\`bash
heroku create saros-rebalancer
\`\`\`

3. **Add Procfile**

Create `Procfile`:
\`\`\`
worker: npm run rebalancer
bot: npm run bot
\`\`\`

4. **Set Environment Variables**

\`\`\`bash
heroku config:set SOLANA_RPC_URL=https://your-rpc-endpoint.com
heroku config:set WALLET_PRIVATE_KEY=your_private_key
heroku config:set TELEGRAM_BOT_TOKEN=your_bot_token
heroku config:set TELEGRAM_CHAT_ID=your_chat_id
heroku config:set MONITORED_POOLS=pool1,pool2,pool3
heroku config:set REBALANCE_INTERVAL_MINUTES=15
heroku config:set VOLATILITY_THRESHOLD=0.05
heroku config:set OUT_OF_RANGE_THRESHOLD=0.1
heroku config:set ENABLE_STOP_LOSS=true
heroku config:set STOP_LOSS_PERCENTAGE=0.15
\`\`\`

5. **Deploy**

\`\`\`bash
git push heroku main
\`\`\`

6. **Scale Workers**

\`\`\`bash
# Start rebalancer
heroku ps:scale worker=1

# Start bot
heroku ps:scale bot=1
\`\`\`

7. **Monitor Logs**

\`\`\`bash
heroku logs --tail
\`\`\`

### Option B: Railway

1. **Install Railway CLI**

\`\`\`bash
npm install -g @railway/cli
railway login
\`\`\`

2. **Initialize Project**

\`\`\`bash
railway init
\`\`\`

3. **Set Environment Variables**

Use Railway dashboard to set all environment variables.

4. **Deploy**

\`\`\`bash
railway up
\`\`\`

### Option C: Docker (Self-Hosted)

1. **Create Dockerfile**

\`\`\`dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

CMD ["npm", "run", "rebalancer"]
\`\`\`

2. **Build Image**

\`\`\`bash
docker build -t saros-rebalancer .
\`\`\`

3. **Run Container**

\`\`\`bash
docker run -d \
  --name saros-rebalancer \
  --env-file .env \
  --restart unless-stopped \
  saros-rebalancer
\`\`\`

## Part 2: Deploy Dashboard

### Vercel Deployment

1. **Install Vercel CLI**

\`\`\`bash
npm install -g vercel
vercel login
\`\`\`

2. **Configure Project**

Create `vercel.json`:
\`\`\`json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
\`\`\`

3. **Deploy**

\`\`\`bash
vercel --prod
\`\`\`

4. **Set Environment Variables**

In Vercel dashboard:
- `NEXT_PUBLIC_API_URL` = Your API endpoint
- Add any other public environment variables

5. **Custom Domain (Optional)**

\`\`\`bash
vercel domains add yourdomain.com
\`\`\`

## Part 3: Production Checklist

### Security

- [ ] Use private RPC endpoint
- [ ] Rotate wallet keys regularly
- [ ] Enable 2FA on all accounts
- [ ] Use environment variables (never hardcode)
- [ ] Implement rate limiting
- [ ] Add request authentication for API
- [ ] Monitor for suspicious activity

### Performance

- [ ] Use connection pooling
- [ ] Implement caching for API responses
- [ ] Optimize database queries
- [ ] Use CDN for static assets
- [ ] Enable compression
- [ ] Monitor response times

### Monitoring

- [ ] Set up error tracking (Sentry)
- [ ] Configure uptime monitoring
- [ ] Set up alerts for failures
- [ ] Monitor gas costs
- [ ] Track rebalancing success rate
- [ ] Log all transactions

### Backup

- [ ] Backup wallet keys securely
- [ ] Export transaction history
- [ ] Document configuration
- [ ] Keep deployment scripts versioned

## Part 4: Mainnet Migration

### Preparation

1. **Test Thoroughly on Devnet**
   - Run for at least 1 week
   - Verify all features work
   - Check gas costs
   - Validate calculations

2. **Update Configuration**

\`\`\`env
SOLANA_RPC_URL=https://mainnet.rpc.endpoint.com
SOLANA_NETWORK=mainnet-beta
MONITORED_POOLS=mainnet_pool_addresses
\`\`\`

3. **Create Mainnet Wallet**

\`\`\`bash
solana-keygen new --outfile ~/.config/solana/mainnet.json
\`\`\`

4. **Fund Wallet**
   - Transfer SOL for gas fees
   - Add liquidity to DLMM pools

5. **Deploy with Caution**
   - Start with small positions
   - Monitor closely for 24 hours
   - Gradually increase position sizes

### Mainnet Best Practices

- Use private RPC for reliability
- Set conservative thresholds initially
- Monitor gas costs closely
- Have emergency stop mechanism
- Keep backup funds for gas
- Document all transactions

## Part 5: Monitoring & Maintenance

### Daily Tasks

- Check Telegram alerts
- Review dashboard metrics
- Verify positions are healthy
- Monitor gas costs

### Weekly Tasks

- Review rebalancing performance
- Analyze fee generation
- Check for SDK updates
- Review error logs
- Optimize thresholds

### Monthly Tasks

- Audit security
- Review and optimize gas usage
- Update dependencies
- Backup configuration
- Performance analysis

## Troubleshooting

### Rebalancer Not Running

\`\`\`bash
# Check Heroku logs
heroku logs --tail --app saros-rebalancer

# Restart worker
heroku ps:restart worker
\`\`\`

### High Gas Costs

- Increase `OUT_OF_RANGE_THRESHOLD`
- Reduce rebalancing frequency
- Use wider ranges in high volatility

### RPC Rate Limits

- Upgrade to private RPC
- Implement request caching
- Add retry logic with backoff

### Dashboard Not Loading

\`\`\`bash
# Check Vercel logs
vercel logs

# Redeploy
vercel --prod --force
\`\`\`

## Cost Estimates

### Devnet (Free)
- Heroku: Free tier
- Vercel: Free tier
- RPC: Public endpoint (free)
- **Total: $0/month**

### Mainnet (Production)
- Heroku: $7-25/month
- Vercel: Free tier
- Private RPC: $50-200/month
- Gas fees: Variable ($10-100/month)
- **Total: ~$70-325/month**

## Support

- Documentation: [README.md](README.md)
- Setup Guide: [SETUP.md](SETUP.md)
- Issues: GitHub Issues
- Community: Saros Discord

## Rollback Procedure

If issues occur:

1. **Stop Services**
\`\`\`bash
heroku ps:scale worker=0 bot=0
\`\`\`

2. **Rollback Deployment**
\`\`\`bash
heroku rollback
\`\`\`

3. **Investigate Logs**
\`\`\`bash
heroku logs --tail
\`\`\`

4. **Fix Issues**
5. **Redeploy**
6. **Restart Services**

---

**Remember**: Always test on devnet first!
