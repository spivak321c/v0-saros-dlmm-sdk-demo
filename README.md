# Saros DLMM Liquidity Provider Dashboard

A comprehensive dashboard for managing DLMM liquidity positions on Saros Finance with advanced features like position monitoring, performance analytics, automated rebalancing, and real-time updates.

## Features

### Position Management
- Real-time position monitoring
- Automated fee collection
- One-click position creation and removal
- Multi-position portfolio tracking

### Analytics & Insights
- Portfolio performance charts
- Fee earnings tracking
- Daily yield calculations
- Impermanent loss monitoring

### Automation
- Auto-rebalancing based on volatility
- Automated fee collection
- Stop-loss protection
- Customizable thresholds

### Real-time Updates
- WebSocket integration for live data
- Price updates
- Position status changes
- Alert notifications

## Project Structure

```
.
├── client/                 # Frontend React application
│   ├── components/        # Reusable UI components
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and providers
│   ├── pages/            # Page components
│   └── src/              # Main app entry
├── server/                # Backend Node.js server
│   ├── services/         # Core business logic
│   ├── solana/           # Solana/DLMM integration
│   ├── routes.ts         # API endpoints
│   └── index.ts          # Server entry
└── shared/               # Shared types and schemas
    └── schema.ts         # Zod validation schemas
```

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm (recommended) or npm
- Solana wallet (Phantom, Solflare, etc.)

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd saros-dlmm-dashboard
```

2. Install dependencies
```bash
pnpm install
```

3. Set up environment variables
```bash
# Copy example env files
cp .env.example .env
cp server/.env.example server/.env

# Edit .env files with your configuration
```

4. Start the development server
```bash
# Terminal 1: Start backend server
cd server
pnpm dev

# Terminal 2: Start frontend
pnpm dev
```

5. Open your browser to `http://localhost:5173`

## Environment Variables

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001/api
VITE_WS_URL=ws://localhost:8080
```

### Backend (server/.env)
```
RPC_ENDPOINT=https://api.mainnet-beta.solana.com
PORT=3001
WS_PORT=8080
NODE_ENV=development
```

## DLMM SDK Integration

The application uses the `@saros-finance/dlmm-sdk` for interacting with Saros DLMM pools. Key integration points:

### Server-side (`server/solana/dlmm-client.ts`)
- Pool information fetching
- Position management
- Liquidity operations
- Fee collection

### Client-side (`client/hooks/`)
- Position data queries
- Real-time updates via WebSocket
- Transaction signing with wallet

## API Endpoints

### Positions
- `GET /api/positions/:wallet` - Get all positions for a wallet
- `GET /api/positions/detail/:address` - Get detailed position info

### Volatility
- `GET /api/volatility/:poolAddress` - Get volatility data for a pool

### Rebalancing
- `POST /api/rebalance` - Execute position rebalance
- `GET /api/rebalance/history/:positionAddress?` - Get rebalance history

### Stop Loss
- `POST /api/stop-loss/set` - Configure stop-loss
- `DELETE /api/stop-loss/:positionAddress` - Remove stop-loss

### Alerts
- `GET /api/alerts` - Get all alerts
- `POST /api/alerts/:id/read` - Mark alert as read

## WebSocket Events

The WebSocket server broadcasts real-time updates:

```typescript
// Position updates
{ type: 'position_update', data: PositionData }

// Price updates
{ type: 'price_update', data: { poolAddress, price, timestamp } }

// Alerts
{ type: 'alert', data: Alert }

// Rebalance events
{ type: 'rebalance_event', data: RebalanceEvent }
```

## Development

### Adding New Features

1. **Server-side service**: Add to `server/services/`
2. **API endpoint**: Add to `server/routes.ts`
3. **Client hook**: Add to `client/hooks/`
4. **UI component**: Add to `client/components/`
5. **Page**: Add to `client/pages/`

### Type Safety

All data structures are validated using Zod schemas in `shared/schema.ts`. This ensures type safety across the entire stack.

## Deployment

### Frontend
```bash
pnpm build
# Deploy dist/ folder to your hosting provider
```

### Backend
```bash
cd server
pnpm build
# Deploy to your Node.js hosting provider
```

## TODO: DLMM SDK Implementation

The current implementation includes placeholder functions for DLMM SDK integration. To complete the integration:

1. Replace placeholder functions in `server/solana/dlmm-client.ts` with actual SDK calls
2. Implement position discovery logic
3. Add proper error handling for blockchain transactions
4. Configure RPC endpoints for production

Refer to the [Saros DLMM SDK Documentation](https://saros-docs.rectorspace.com/docs/dlmm-sdk/overview) for implementation details.

## Contributing

Contributions are welcome! Please follow the existing code style and add tests for new features.

## License

MIT

## Support

For issues and questions:
- GitHub Issues: [Create an issue]
- Saros Discord: [Join community]
- Documentation: [Saros Docs](https://saros-docs.rectorspace.com)
