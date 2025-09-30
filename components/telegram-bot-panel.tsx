"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Bot,
  Bell,
  RefreshCw,
  Settings,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface TelegramBotPanelProps {
  isConnected?: boolean;
  botUsername?: string;
  lastActivity?: string;
}

export function TelegramBotPanel({
  isConnected = false,
  botUsername = "SarosDLMMBot",
  lastActivity = "2 minutes ago",
}: TelegramBotPanelProps) {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [notifications, setNotifications] = useState([
    {
      id: 1,
      message: "Position SOL/USDC out of range",
      time: "5m ago",
      type: "warning",
    },
    {
      id: 2,
      message: "Rebalanced position #1234",
      time: "15m ago",
      type: "success",
    },
    {
      id: 3,
      message: "High volatility detected",
      time: "1h ago",
      type: "info",
    },
  ]);

  const handleCommand = async (command: string) => {
    console.log(`Executing command: ${command}`);
    // In production, this would call the Telegram bot API
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            <CardTitle className="text-base sm:text-lg">Telegram Bot</CardTitle>
          </div>
          <Badge
            variant={isConnected ? "default" : "secondary"}
            className="gap-1 text-xs"
          >
            {isConnected ? (
              <>
                <CheckCircle2 className="h-3 w-3" />
                <span className="hidden sm:inline">Connected</span>
              </>
            ) : (
              <>
                <XCircle className="h-3 w-3" />
                <span className="hidden sm:inline">Disconnected</span>
              </>
            )}
          </Badge>
        </div>
        <CardDescription className="text-xs sm:text-sm">
          Interactive bot for position monitoring
          {isConnected && (
            <span className="hidden sm:inline"> • @{botUsername}</span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Bot Status */}
        <div className="flex items-center justify-between p-2 sm:p-3 rounded-lg bg-muted/50">
          <div className="space-y-1">
            <p className="text-xs sm:text-sm font-medium">Monitoring Status</p>
            <p className="text-xs text-muted-foreground">
              Last: {lastActivity}
            </p>
          </div>
          <Button
            variant={isMonitoring ? "default" : "outline"}
            size="sm"
            onClick={() => setIsMonitoring(!isMonitoring)}
            className="text-xs"
          >
            {isMonitoring ? "Stop" : "Start"}
          </Button>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <p className="text-xs sm:text-sm font-medium">Quick Actions</p>
          <div className="grid grid-cols-1 xs:grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCommand("/monitor")}
              className="justify-start text-xs"
            >
              <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="truncate">Check Positions</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCommand("/rebalance")}
              className="justify-start text-xs"
            >
              <Send className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="truncate">Force Rebalance</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCommand("/stats")}
              className="justify-start text-xs"
            >
              <Bell className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="truncate">Get Statistics</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCommand("/volatility")}
              className="justify-start text-xs"
            >
              <Settings className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="truncate">Check Volatility</span>
            </Button>
          </div>
        </div>

        {/* Recent Notifications */}
        <div className="space-y-2">
          <p className="text-xs sm:text-sm font-medium">Recent Notifications</p>
          <div className="space-y-2 max-h-40 sm:max-h-48 overflow-y-auto">
            {notifications.map((notification) => (
              <div
                key={notification.id}
                className="flex items-start gap-2 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div
                  className={`h-2 w-2 rounded-full mt-1.5 flex-shrink-0 ${
                    notification.type === "warning"
                      ? "bg-orange-500"
                      : notification.type === "success"
                      ? "bg-green-500"
                      : "bg-blue-500"
                  }`}
                />
                <div className="flex-1 space-y-1 min-w-0">
                  <p className="text-xs sm:text-sm truncate">
                    {notification.message}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {notification.time}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Setup Instructions */}
        {!isConnected && (
          <div className="p-3 rounded-lg border border-dashed space-y-2">
            <p className="text-xs sm:text-sm font-medium">Setup Instructions</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li className="leading-relaxed">
                Search for @{botUsername} on Telegram
              </li>
              <li className="leading-relaxed">Start a chat and send /start</li>
              <li className="leading-relaxed">
                Copy your chat ID and add to env
              </li>
              <li className="leading-relaxed">Restart the application</li>
            </ol>
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 bg-transparent text-xs"
              asChild
            >
              <a
                href={`https://t.me/${botUsername}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Telegram Bot
              </a>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
