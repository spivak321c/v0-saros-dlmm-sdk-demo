import { useEffect, useState, useCallback } from "react";

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

  useEffect(() => {
    console.log("[WebSocket] Connecting to:", WS_URL);
    const websocket = new WebSocket(WS_URL);

    websocket.onopen = () => {
      console.log("[WebSocket] Connected successfully");
      setConnected(true);
    };

    websocket.onclose = () => {
      console.log("[WebSocket] Disconnected");
      setConnected(false);
    };

    websocket.onerror = (error) => {
      console.error("[WebSocket] Error:", error);
      setConnected(false);
    };

    websocket.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        console.log(
          "[WebSocket] Message received:",
          message.type,
          message.data
        );
        setLastMessage(message);
      } catch (error) {
        console.error("[WebSocket] Failed to parse message:", error);
      }
    };

    setWs(websocket);

    return () => {
      websocket.close();
    };
  }, []);

  const send = useCallback(
    (type: string, data: any) => {
      if (ws && connected) {
        console.log("[WebSocket] Sending message:", type, data);
        ws.send(JSON.stringify({ type, data, timestamp: Date.now() }));
      } else {
        console.warn("[WebSocket] Cannot send message - not connected");
      }
    },
    [ws, connected]
  );

  return { connected, lastMessage, send };
}
