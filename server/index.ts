//import express from "express";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import dotenv from "dotenv";
import { createServer } from "http";
import routes from "./routes";
import { wsServer } from "./services/websocket-server";
import { positionMonitor } from "./services/position-monitor";
import { volatilityTracker } from "./services/volatility-tracker";
import { telegramBot } from "./services/telegram-bot";
import { logger } from "./utils/logger";
/*
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
*/

dotenv.config();

const app = express();

// Middleware
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.method !== "GET" ? req.body : undefined,
  });
  next();
});

// Routes
app.use("/api", routes);

// Health check
app.get("/health", (req: Request, res: Response) => {
  logger.debug("Health check requested");
  res.json({ status: "ok", timestamp: Date.now() });
});

// Global error handler (prevents Express swallows, logs to Vercel)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// Vercel export: No listen()—serverless handles requests
export default app;

// Lazy startup (runs on first request, avoids cold-start crashes)
let servicesStarted = false;
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!servicesStarted) {
    startServices().catch((err) => {
      logger.error("Service startup failed:", err);
      // Don't crash function—log and continue
    });
    servicesStarted = true;
  }
  next();
});

async function startServices() {
  const isServerless =
    process.env.VERCEL_ENV === "production" || !!process.env.VERCEL_URL;

  logger.info(`Starting services (serverless mode: ${isServerless})`);

  // Load and restore automation settings from storage
  const storage = require("./storage").default;
  const settings = storage.getSettings();

  if (settings?.autoRebalance && settings?.monitoredWallet && !isServerless) {
    // Delay startup to avoid initial rate limiting (non-serverless only)
    setTimeout(() => {
      positionMonitor.startMonitoring([settings.monitoredWallet]);
      positionMonitor.startAutoRebalancing(settings.rebalanceThreshold || 5);
      logger.info("Auto-rebalancing restored successfully");
    }, 3000);
  } else if (isServerless) {
    logger.warn(
      "Skipping auto-rebalancing in serverless mode—use cron/external scheduler"
    );
  }

  // Telegram: Launch only if non-serverless (serverless can't run persistent bots)
  if (!isServerless) {
    telegramBot.launch();
    logger.info("Telegram bot launched");
  } else {
    logger.warn(
      "Skipping Telegram bot launch in serverless mode—use separate service"
    );
  }

  // WebSocket: Attach if HTTP server available (skip in serverless)
  if (!isServerless) {
    const httpServer = require("http").createServer(app);
    wsServer.start(httpServer);
    logger.info("WebSocket server attached");
  } else {
    logger.warn("Skipping WebSocket in serverless mode—use Upstash or Pusher");
  }

  // Volatility tracker: Start if non-serverless
  // if (!isServerless) {
  //   volatilityTracker.startTracking();
  //   logger.info("Volatility tracker started");
  // }

  logger.info("Services startup complete");
}

// Graceful shutdown (serverless ignores, but good for local)
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
