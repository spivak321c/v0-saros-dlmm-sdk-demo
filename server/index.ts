import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { wsServer } from './services/websocket-server';
import { positionMonitor } from './services/position-monitor';
import { volatilityTracker } from './services/volatility-tracker';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, { 
    query: req.query, 
    body: req.method !== 'GET' ? req.body : undefined 
  });
  next();
});

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  logger.debug('Health check requested');
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`API available at http://localhost:${PORT}/api`);
  
  // Start WebSocket server
  wsServer.start(Number(WS_PORT));
  logger.info(`WebSocket server running on port ${WS_PORT}`);
  
  // Start monitoring services
  // Note: In production, you'd start these based on user configuration
  logger.info('Server ready - all services started');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  positionMonitor.stopMonitoring();
  volatilityTracker.stopTracking();
  wsServer.stop();
  process.exit(0);
});
