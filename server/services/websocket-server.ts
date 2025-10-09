import WebSocket from "ws";
import storage from "../storage";
import { logger } from "../utils/logger";
import type { WSMessage } from "../../shared/schema";

export class WSServer {
  private wss: WebSocket.Server | null = null;
  private clients: Set<any> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;

  start(port: number = 8080) {
    logger.info("Starting WebSocket server", { port });
    this.wss = new WebSocket.Server({ port });

    this.wss.on("connection", (ws: any) => {
      logger.info("WebSocket client connected", {
        totalClients: this.clients.size + 1,
      });
      this.clients.add(ws);

      ws.on("close", () => {
        logger.info("WebSocket client disconnected", {
          totalClients: this.clients.size - 1,
        });
        this.clients.delete(ws);
      });

      ws.on("error", (error: any) => {
        logger.error("WebSocket client error", { error: error.message });
        this.clients.delete(ws);
      });

      // Send initial data
      this.sendInitialData(ws);
    });

    // Start periodic updates
    this.startPeriodicUpdates();

    logger.info("WebSocket server started successfully", { port });
  }

  stop() {
    logger.info("Stopping WebSocket server");
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    logger.info("WebSocket server stopped");
  }

  private sendInitialData(ws: WebSocket) {
    const positions = storage.getAllPositions();
    logger.debug("Sending initial data to client", {
      positionCount: positions.length,
    });

    positions.forEach((position) => {
      this.sendToClient(ws, {
        type: "position_update",
        data: position,
      });
    });
  }

  private startPeriodicUpdates() {
    logger.info("Starting periodic WebSocket updates", { intervalMs: 5000 });
    this.updateInterval = setInterval(() => {
      this.broadcastUpdates();
    }, 5000); // Update every 5 seconds
  }

  private broadcastUpdates() {
    const positions = storage.getAllPositions();
    logger.debug("Broadcasting updates", {
      positionCount: positions.length,
      clientCount: this.clients.size,
    });

    positions.forEach((position) => {
      this.broadcast({
        type: "position_update",
        data: position,
      });
    });

    // Broadcast unread alerts
    const alerts = storage.getAlerts(true);
    logger.debug("Broadcasting alerts", { alertCount: alerts.length });
    alerts.forEach((alert) => {
      this.broadcast({
        type: "alert",
        data: alert,
      });
    });
  }

  broadcast(message: WSMessage) {
    const data = JSON.stringify(message);

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  private sendToClient(client: WebSocket, message: WSMessage) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  broadcastPriceUpdate(poolAddress: string, price: number) {
    this.broadcast({
      type: "price_update",
      data: {
        poolAddress,
        price,
        timestamp: Date.now(),
      },
    });
  }

  broadcastRebalanceEvent(event: any) {
    this.broadcast({
      type: "rebalance_event",
      data: event,
    });
  }
}

export const wsServer = new WSServer();
