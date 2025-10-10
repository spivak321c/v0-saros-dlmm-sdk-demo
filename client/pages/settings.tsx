import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@solana/wallet-adapter-react";
import { Save, AlertCircle } from "lucide-react";
import { useWebSocket } from "@/lib/websocket";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001/api";

export default function Settings() {
  const { toast } = useToast();
  const { publicKey } = useWallet();
  const [autoRebalance, setAutoRebalance] = useState(false);
  const [autoCollectFees, setAutoCollectFees] = useState(true);
  const [rebalanceThreshold, setRebalanceThreshold] = useState([5]);
  const [feeThreshold, setFeeThreshold] = useState(10);
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossThreshold, setStopLossThreshold] = useState([10]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoRebalanceActive, setAutoRebalanceActive] = useState(false);
  const { lastMessage } = useWebSocket();

  useEffect(() => {
    loadSettings();
    loadAutoRebalanceStatus();
  }, []);

  // Listen for WebSocket updates
  useEffect(() => {
    if (!lastMessage) return;

    if (lastMessage.type === "auto_rebalance_status") {
      const status = lastMessage.data;
      setAutoRebalanceActive(status.enabled);
      if (status.threshold) {
        setRebalanceThreshold([status.threshold]);
      }
    } else if (lastMessage.type === "alert") {
      const alert = lastMessage.data;
      if (alert.type === "warning" && alert.title === "Rebalance Recommended") {
        toast({
          title: alert.title,
          description: alert.message,
          variant: "default",
        });
      }
    } else if (lastMessage.type === "rebalance_check") {
      const data = lastMessage.data;
      if (data.shouldRebalance) {
        console.log("[Settings] Rebalance check:", data);
      }
    }
  }, [lastMessage, toast]);

  const loadAutoRebalanceStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/automation/rebalance/status`);
      const result = await response.json();

      if (result.success && result.data) {
        setAutoRebalanceActive(result.data.enabled);
      }
    } catch (error) {
      console.error("[Settings] Failed to load auto-rebalance status:", error);
    }
  };

  const loadSettings = async () => {
    try {
      const response = await fetch(`${API_URL}/settings`);
      const result = await response.json();

      if (result.success && result.data) {
        const settings = result.data;
        setAutoRebalance(settings.autoRebalance || false);
        setAutoCollectFees(settings.autoCollectFees !== false);
        setRebalanceThreshold([settings.rebalanceThreshold || 5]);
        setFeeThreshold(settings.feeThreshold || 10);
        setStopLossEnabled(settings.stopLossEnabled || false);
        setStopLossThreshold([settings.stopLossThreshold || 10]);
      }
    } catch (error) {
      console.error("[Settings] Failed to load settings:", error);
      toast({
        title: "Error",
        description: "Failed to load settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      const settingsData = {
        autoRebalance,
        autoCollectFees,
        rebalanceThreshold: rebalanceThreshold[0],
        feeThreshold,
        stopLossEnabled,
        stopLossThreshold: stopLossThreshold[0],
      };

      const response = await fetch(`${API_URL}/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsData),
      });

      const result = await response.json();

      if (result.success) {
        // Handle auto-rebalancing activation/deactivation
        if (autoRebalance && !autoRebalanceActive) {
          await startAutoRebalancing();
        } else if (!autoRebalance && autoRebalanceActive) {
          await stopAutoRebalancing();
        }

        toast({
          title: "Success",
          description: "Settings saved successfully",
        });
      } else {
        throw new Error(result.error || "Failed to save settings");
      }
    } catch (error) {
      console.error("[Settings] Failed to save settings:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const startAutoRebalancing = async () => {
    if (!publicKey) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to enable auto-rebalancing",
        variant: "destructive",
      });
      return;
    }

    try {
      const response = await fetch(`${API_URL}/automation/rebalance/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: publicKey.toString(),
          threshold: rebalanceThreshold[0],
        }),
      });

      const result = await response.json();

      if (result.success) {
        setAutoRebalanceActive(true);
        toast({
          title: "Auto-Rebalancing Started",
          description: `Monitoring positions for ${publicKey
            .toString()
            .slice(0, 8)}...`,
        });
      } else {
        throw new Error(result.error || "Failed to start auto-rebalancing");
      }
    } catch (error) {
      console.error("[Settings] Failed to start auto-rebalancing:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to start auto-rebalancing",
        variant: "destructive",
      });
    }
  };

  const stopAutoRebalancing = async () => {
    try {
      const response = await fetch(`${API_URL}/automation/rebalance/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const result = await response.json();

      if (result.success) {
        setAutoRebalanceActive(false);
        toast({
          title: "Auto-Rebalancing Stopped",
          description: "Position monitoring has been disabled",
        });
      } else {
        throw new Error(result.error || "Failed to stop auto-rebalancing");
      }
    } catch (error) {
      console.error("[Settings] Failed to stop auto-rebalancing:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "Failed to stop auto-rebalancing",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Configure automation and risk management preferences
        </p>
      </div>

      {/* Automation Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Automation</CardTitle>
          <CardDescription>
            Configure automatic position management
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-rebalance">Auto Rebalance</Label>
              <p className="text-sm text-muted-foreground">
                Automatically rebalance positions when out of range
              </p>
            </div>
            <Switch
              id="auto-rebalance"
              checked={autoRebalance}
              onCheckedChange={setAutoRebalance}
            />
          </div>

          {autoRebalance && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <div className="flex items-center justify-between">
                <Label>Rebalance Threshold: {rebalanceThreshold[0]}%</Label>
                {autoRebalanceActive && (
                  <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                    Active
                  </span>
                )}
              </div>
              <Slider
                value={rebalanceThreshold}
                onValueChange={setRebalanceThreshold}
                min={1}
                max={20}
                step={1}
              />
              <p className="text-xs text-muted-foreground">
                Trigger rebalance alert when price is within this % of range
                boundary
              </p>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t">
            <div className="space-y-0.5">
              <Label htmlFor="auto-collect">Auto Collect Fees</Label>
              <p className="text-sm text-muted-foreground">
                Automatically collect fees when threshold is reached
              </p>
            </div>
            <Switch
              id="auto-collect"
              checked={autoCollectFees}
              onCheckedChange={setAutoCollectFees}
            />
          </div>

          {autoCollectFees && (
            <div className="space-y-2 pl-4 border-l-2 border-primary/20">
              <Label htmlFor="fee-threshold">Fee Threshold ($)</Label>
              <Input
                id="fee-threshold"
                type="number"
                value={feeThreshold}
                onChange={(e) => setFeeThreshold(Number(e.target.value))}
                min={1}
              />
              <p className="text-xs text-muted-foreground">
                Collect fees when they reach this amount
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Risk Management */}
      <Card>
        <CardHeader>
          <CardTitle>Risk Management</CardTitle>
          <CardDescription>
            Configure stop-loss and risk controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="stop-loss">Stop Loss Protection</Label>
              <p className="text-sm text-muted-foreground">
                Automatically close positions at loss threshold
              </p>
            </div>
            <Switch
              id="stop-loss"
              checked={stopLossEnabled}
              onCheckedChange={setStopLossEnabled}
            />
          </div>

          {stopLossEnabled && (
            <div className="space-y-2 pl-4 border-l-2 border-destructive/20">
              <Label>Stop Loss Threshold: {stopLossThreshold[0]}%</Label>
              <Slider
                value={stopLossThreshold}
                onValueChange={setStopLossThreshold}
                min={5}
                max={50}
                step={5}
              />
              <p className="text-xs text-muted-foreground">
                Close position when loss exceeds this percentage
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertCircle className="h-4 w-4 text-warning mt-0.5 flex-shrink-0" />
            <div className="space-y-1 flex-1">
              <p className="text-xs font-medium text-warning">Important</p>
              <p className="text-xs text-muted-foreground">
                Automated actions require wallet approval. Make sure your wallet
                is connected and unlocked.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={saveSettings} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
