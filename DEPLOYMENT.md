# Deployment Guide

This guide covers deploying the Saros DLMM LP Dashboard to various platforms.

## Prerequisites

Before deploying, ensure you have:
- Solana RPC endpoint (Helius, QuickNode, or Alchemy recommended)
- Wallet private key (base64 encoded)
- Telegram bot token and chat ID (optional but recommended)

## Platform Options

### 1. Railway (Recommended for Full-Stack Apps)

Railway is ideal for this app since it needs both frontend and backend with WebSocket support.

#### Steps:

1. **Create Railway Account**: Go to [railway.app](https://railway.app) and sign up

2. **Create New Project**:
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account and select your repository

3. **Configure Environment Variables**:
   In Railway dashboard, add these variables:
   ```
   SOLANA_RPC_URL=your_rpc_endpoint
   WALLET_PRIVATE_KEY=your_base64_private_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   PORT=3001
   NODE_ENV=production
   ```

4. **Deploy**:
   - Railway will automatically detect `railway.json` and use the build configuration
   - Build and deployment will start automatically
   - Your app will be available at `https://your-app.railway.app`

5. **Enable WebSocket** (if needed):
   - Railway supports WebSockets by default
   - No additional configuration needed

#### Cost:
- Free tier: $5 credit/month
- Paid: ~$5-20/month depending on usage

---

### 2. Render

Render is another good option for full-stack apps with WebSocket support.

#### Steps:

1. **Create Render Account**: Go to [render.com](https://render.com)

2. **Create Web Service**:
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name**: saros-dlmm-dashboard
     - **Environment**: Node
     - **Build Command**: `bash start-production.sh`
     - **Start Command**: `cd server && node dist/index.js`

3. **Add Environment Variables**:
   ```
   SOLANA_RPC_URL=your_rpc_endpoint
   WALLET_PRIVATE_KEY=your_base64_private_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   NODE_ENV=production
   ```

4. **Deploy**: Click "Create Web Service"

#### Cost:
- Free tier available (with limitations)
- Paid: $7/month for starter instance

---

### 3. Vercel (Frontend) + Railway/Render (Backend)

**Note**: Vercel has limitations with WebSockets and long-running processes. Best to split deployment.

#### Frontend on Vercel:

1. **Create Vercel Account**: Go to [vercel.com](https://vercel.com)

2. **Import Project**:
   - Click "Add New" → "Project"
   - Import your GitHub repository
   - Vercel will auto-detect Vite

3. **Configure Build**:
   - **Framework Preset**: Vite
   - **Build Command**: `pnpm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `pnpm install`

4. **Add Environment Variables**:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```

5. **Deploy**: Click "Deploy"

#### Backend on Railway/Render:
Follow Railway or Render instructions above for the backend.

#### Cost:
- Vercel: Free for hobby projects
- Backend: See Railway/Render pricing above

---

### 4. DigitalOcean App Platform

Good for full-stack apps with more control.

#### Steps:

1. **Create DigitalOcean Account**: Go to [digitalocean.com](https://digitalocean.com)

2. **Create App**:
   - Click "Create" → "Apps"
   - Connect GitHub repository
   - Select branch

3. **Configure Components**:
   - **Type**: Web Service
   - **Build Command**: `bash start-production.sh`
   - **Run Command**: `cd server && node dist/index.js`
   - **HTTP Port**: 3001

4. **Add Environment Variables**:
   ```
   SOLANA_RPC_URL=your_rpc_endpoint
   WALLET_PRIVATE_KEY=your_base64_private_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   NODE_ENV=production
   ```

5. **Deploy**: Click "Create Resources"

#### Cost:
- Basic: $5/month
- Professional: $12/month

---

### 5. Self-Hosted (VPS)

Deploy on your own VPS (DigitalOcean Droplet, AWS EC2, etc.)

#### Steps:

1. **Setup VPS**:
   ```bash
   # SSH into your server
   ssh root@your-server-ip
   
   # Install Node.js 18+
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install pnpm
   npm install -g pnpm
   
   # Install PM2 for process management
   npm install -g pm2
   ```

2. **Clone Repository**:
   ```bash
   git clone https://github.com/your-username/your-repo.git
   cd your-repo
   ```

3. **Configure Environment**:
   ```bash
   # Create server/.env
   nano server/.env
   ```
   
   Add your environment variables:
   ```
   SOLANA_RPC_URL=your_rpc_endpoint
   WALLET_PRIVATE_KEY=your_base64_private_key
   TELEGRAM_BOT_TOKEN=your_telegram_bot_token
   TELEGRAM_CHAT_ID=your_telegram_chat_id
   PORT=3001
   ```

4. **Build and Start**:
   ```bash
   # Install and build
   bash start-production.sh
   
   # Start with PM2
   pm2 start server/dist/index.js --name saros-dlmm
   pm2 save
   pm2 startup
   ```

5. **Setup Nginx Reverse Proxy** (optional):
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       
       location / {
           proxy_pass http://localhost:3001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Setup SSL with Let's Encrypt**:
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

#### Cost:
- VPS: $5-10/month (DigitalOcean, Linode, Vultr)

---

## Environment Variables Reference

Required for all deployments:

| Variable | Description | Example |
|----------|-------------|---------|
| `SOLANA_RPC_URL` | Solana RPC endpoint | `https://api.devnet.solana.com` |
| `WALLET_PRIVATE_KEY` | Base64 encoded private key | `[1,2,3,...]` as base64 |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (optional) | `123456:ABC-DEF...` |
| `TELEGRAM_CHAT_ID` | Telegram chat ID (optional) | `123456789` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `production` |

---

## Post-Deployment Checklist

After deploying:

1. ✅ **Test API endpoints**: Visit `https://your-app.com/api/health`
2. ✅ **Connect wallet**: Test wallet connection on frontend
3. ✅ **Create position**: Test creating a DLMM position
4. ✅ **Check WebSocket**: Verify real-time updates work
5. ✅ **Test Telegram**: Send test notification
6. ✅ **Monitor logs**: Check for errors in deployment logs
7. ✅ **Setup monitoring**: Use platform monitoring or external service

---

## Troubleshooting

### Build Fails
- Check Node.js version (needs 18+)
- Verify all dependencies install correctly
- Check build logs for specific errors

### WebSocket Not Working
- Ensure platform supports WebSockets (Railway, Render do)
- Check firewall/security group settings
- Verify WebSocket upgrade headers are passed through

### Telegram Not Sending
- Verify bot token and chat ID are correct
- Check bot has permission to send messages
- Test bot manually with `/start` command

### RPC Rate Limiting
- Use paid RPC provider (Helius, QuickNode)
- Implement request caching
- Add retry logic with exponential backoff

### Storage Issues
- Ensure write permissions for `storage.json`
- Consider using database for production (PostgreSQL, MongoDB)
- Implement backup strategy

---

## Recommended Setup

For production, I recommend:

**Option 1 - Simple (Railway)**:
- Deploy entire app on Railway
- Cost: ~$5-10/month
- Easy setup, good for getting started

**Option 2 - Scalable (Vercel + Railway)**:
- Frontend on Vercel (free)
- Backend on Railway ($5-10/month)
- Better performance, easier to scale

**Option 3 - Full Control (VPS)**:
- Self-hosted on DigitalOcean/AWS
- Cost: $5-20/month
- Full control, can optimize costs

---

## Security Notes

⚠️ **Important Security Considerations**:

1. **Never commit private keys** to Git
2. **Use environment variables** for all secrets
3. **Enable HTTPS** in production
4. **Implement rate limiting** on API endpoints
5. **Use read-only RPC** when possible
6. **Monitor wallet transactions** regularly
7. **Backup storage.json** regularly
8. **Use separate wallets** for dev/prod

---

## Need Help?

- Check deployment platform docs
- Review application logs
- Test locally first with `pnpm run build`
- Verify environment variables are set correctly
