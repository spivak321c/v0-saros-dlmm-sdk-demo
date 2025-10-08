import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import routes from './routes';
import { wsServer } from './services/websocket-server';
import { positionMonitor } from './services/position-monitor';
import { volatilityTracker } from './services/volatility-tracker';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const WS_PORT = process.env.WS_PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  
  // Start WebSocket server
  wsServer.start(Number(WS_PORT));
  
  // Start monitoring services
  // Note: In production, you'd start these based on user configuration
  console.log('Server ready');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  positionMonitor.stopMonitoring();
  volatilityTracker.stopTracking();
  wsServer.stop();
  process.exit(0);
});
