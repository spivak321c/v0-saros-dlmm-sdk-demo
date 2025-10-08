import { Circle } from 'lucide-react';
import { useWebSocket } from '../lib/websocket';

export function WebSocketStatus() {
  const { connected } = useWebSocket();

  return (
    <div className="flex items-center gap-2 text-sm">
      <Circle
        className={`h-2 w-2 ${connected ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'}`}
      />
      <span className="text-gray-600">
        {connected ? 'Live' : 'Disconnected'}
      </span>
    </div>
  );
}
