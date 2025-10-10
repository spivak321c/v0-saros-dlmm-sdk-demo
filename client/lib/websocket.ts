import { useEffect, useState, useCallback, useRef } from "react";

// Construct WebSocket URL from current location
const getWsUrl = () => {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }

  // Use current host for WebSocket connection with /ws path
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  return `${protocol}//${host}/ws`;
};

const WS_URL = getWsUrl();

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export function useWebSocket() {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const RECONNECT_DELAY = 3000;

  const connect = useCallback(() => {
    console.log("[WebSocket] Attempting to connect to:", WS_URL);

    try {
      const websocket = new WebSocket(WS_URL);

      websocket.onopen = () => {
        console.log("[WebSocket] ✅ Connected successfully");
        setConnected(true);
        reconnectAttemptsRef.current = 0;
      };

      websocket.onclose = (event) => {
        console.log("[WebSocket] ❌ Disconnected", {
          code: event.code,
          reason: event.reason,
        });
        setConnected(false);

        // Attempt to reconnect
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          reconnectAttemptsRef.current++;
          console.log(
            `[WebSocket] 🔄 Reconnecting in ${RECONNECT_DELAY}ms (attempt ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`
          );
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, RECONNECT_DELAY);
        } else {
          console.error("[WebSocket] ⛔ Max reconnection attempts reached");
        }
      };

      websocket.onerror = (error) => {
        console.error("[WebSocket] ⚠️ Error:", error);
        setConnected(false);
      };

      websocket.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log(
            "[WebSocket] 📨 Message received:",
            message.type,
            message.data
          );
          setLastMessage(message);
        } catch (error) {
          console.error("[WebSocket] ❌ Failed to parse message:", error);
        }
      };

      setWs(websocket);
    } catch (error) {
      console.error("[WebSocket] ❌ Failed to create WebSocket:", error);
      setConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      console.log("[WebSocket] 🧹 Cleaning up connection");
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (ws) {
        ws.close();
      }
    };
  }, [connect]);

  const send = useCallback(
    (type: string, data: any) => {
      if (ws && connected && ws.readyState === WebSocket.OPEN) {
        console.log("[WebSocket] 📤 Sending message:", type, data);
        try {
          ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
        } catch (error) {
          console.error("[WebSocket] ❌ Failed to send message:", error);
        }
      } else {
        console.warn("[WebSocket] ⚠️ Cannot send message - not connected", {
          hasWs: !!ws,
          connected,
          readyState: ws?.readyState,
        });
      }
    },
    [ws, connected]
  );

  return { connected, lastMessage, send };
}
