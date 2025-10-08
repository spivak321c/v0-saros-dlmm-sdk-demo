import WebSocket from 'ws';
import { storage } from '../storage';
import type { WSMessage } from '../../shared/schema';

export class WSServer {
  private wss: WebSocket.Server | null = null;
  private clients: Set<any> = new Set();
  private updateInterval: NodeJS.Timeout | null = null;

  start(port: number = 8080) {
    this.wss = new WebSocket.Server({ port });

    this.wss.on('connection', (ws: any) => {
      console.log('Client connected');
      this.clients.add(ws);

      ws.on('close', () => {
        console.log('Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error: any) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });

      // Send initial data
      this.sendInitialData(ws);
    });

    // Start periodic updates
    this.startPeriodicUpdates();

    console.log(`WebSocket server started on port ${port}`);
  }

  stop() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    this.clients.clear();
    console.log('WebSocket server stopped');
  }

  private sendInitialData(ws: WebSocket) {
    const positions = storage.getAllPositions();
    
    positions.forEach((position) => {
      this.sendToClient(ws, {
        type: 'position_update',
        data: position,
      });
    });
  }

  private startPeriodicUpdates() {
    this.updateInterval = setInterval(() => {
      this.broadcastUpdates();
    }, 5000); // Update every 5 seconds
  }

  private broadcastUpdates() {
    const positions = storage.getAllPositions();
    
    positions.forEach((position) => {
      this.broadcast({
        type: 'position_update',
        data: position,
      });
    });

    // Broadcast unread alerts
    const alerts = storage.getAlerts(true);
    alerts.forEach((alert) => {
      this.broadcast({
        type: 'alert',
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
      type: 'price_update',
      data: {
        poolAddress,
        price,
        timestamp: Date.now(),
      },
    });
  }

  broadcastRebalanceEvent(event: any) {
    this.broadcast({
      type: 'rebalance_event',
      data: event,
    });
  }
}

export const wsServer = new WSServer();
