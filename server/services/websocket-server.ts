import { WebSocketServer, WebSocket as WS } from "ws";
import type { Server as HTTPServer } from "http";
import storage from "../storage";
import { logger } from "../utils/logger";
import type { WSMessage } from "../../shared/schema";

export class WSServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<any> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;

  start(server: HTTPServer) {
    logger.info("Starting WebSocket server on HTTP server");
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws: any) => {
      logger.info("[WebSocket] Client connected", {
        totalClients: this.clients.size + 1,
      });
      this.clients.add(ws);

      ws.on("close", () => {
        logger.info("[WebSocket] Client disconnected", {
          totalClients: this.clients.size - 1,
        });
        this.clients.delete(ws);
      });

      ws.on("error", (error: any) => {
        logger.error("[WebSocket] Client error", { error: error.message });
        this.clients.delete(ws);
      });

      ws.on("message", (data: any) => {
        try {
          const message = JSON.parse(data.toString());
          logger.debug("[WebSocket] Received message from client", {
            type: message.type,
          });
        } catch (error) {
          logger.error("[WebSocket] Failed to parse client message", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      // Send initial data
      this.sendInitialData(ws);
    });

    // Start periodic updates
    this.startPeriodicUpdates();

    logger.info("WebSocket server started successfully on /ws path");
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
    logger.info("Starting periodic WebSocket updates", { intervalMs: 60000 });
    this.updateInterval = setInterval(() => {
      this.broadcastUpdates();
    }, 60000); // Update every 60 seconds to avoid rate limiting
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
    logger.debug("[WebSocket] Broadcasting message", {
      type: message.type,
      clientCount: this.clients.size,
    });

    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(data);
          logger.debug("[WebSocket] Message sent to client", {
            type: message.type,
          });
        } catch (error) {
          logger.error("[WebSocket] Failed to send message to client", {
            error: error instanceof Error ? error.message : String(error),
          });
        }
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

  broadcastAutoRebalanceStatus(status: {
    enabled: boolean;
    threshold: number;
    lastCheck?: number;
  }) {
    this.broadcast({
      type: "auto_rebalance_status",
      data: status,
    });
  }
}

export const wsServer = new WSServer();
