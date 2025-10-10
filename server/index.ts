import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import routes from "./routes";
import { wsServer } from "./services/websocket-server";
import { positionMonitor } from "./services/position-monitor";
import { volatilityTracker } from "./services/volatility-tracker";
import { telegramBot } from "./services/telegram-bot";
import { logger } from "./utils/logger";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const httpServer = createServer(app);

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== "GET" ? req.body : undefined,
  });
  next();
});

// Routes
app.use("/api", routes);

// Health check
app.get("/health", (req, res) => {
  logger.debug("Health check requested");
  res.json({ status: "ok", timestamp: Date.now() });
});

// Start server
httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`API available at http://localhost:${PORT}/api`);

  // Start WebSocket server on the same HTTP server
  wsServer.start(httpServer);
  logger.info(`WebSocket server attached to HTTP server`);

  // Launch Telegram bot for interactive commands
  telegramBot.launch();

  // Load and restore automation settings from storage
  const storage = require("./storage").default;
  const settings = storage.getSettings();

  if (settings?.autoRebalance && settings?.monitoredWallet) {
    logger.info("Restoring auto-rebalancing from saved settings", {
      wallet: settings.monitoredWallet,
      threshold: settings.rebalanceThreshold || 5,
    });

    // Delay startup to avoid initial rate limiting
    setTimeout(() => {
      positionMonitor.startMonitoring([settings.monitoredWallet]);
      positionMonitor.startAutoRebalancing(settings.rebalanceThreshold || 5);
      logger.info("Auto-rebalancing restored successfully");
    }, 3000);
  }

  logger.info("Server ready - all services started");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully");
  positionMonitor.stopMonitoring();
  volatilityTracker.stopTracking();
  wsServer.stop();
  telegramBot.stop();
  process.exit(0);
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully");
  positionMonitor.stopMonitoring();
  volatilityTracker.stopTracking();
  wsServer.stop();
  telegramBot.stop();
  process.exit(0);
});
