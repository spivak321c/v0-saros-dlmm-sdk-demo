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

export default function Settings() {
  const [autoRebalance, setAutoRebalance] = useState(false);
  const [autoCollectFees, setAutoCollectFees] = useState(true);
  const [rebalanceThreshold, setRebalanceThreshold] = useState([5]);
  const [feeThreshold, setFeeThreshold] = useState(10);
  const [stopLossEnabled, setStopLossEnabled] = useState(false);
  const [stopLossThreshold, setStopLossThreshold] = useState([10]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL ||
        "http://localhost:3001/api"}/settings`;
      console.log("[Settings] Loading settings from:", apiUrl);
      const response = await fetch(apiUrl);
      const result = await response.json();
      console.log("[Settings] Loaded settings:", result);

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
    }
  };

  const saveSettings = async (settingsData: any) => {
    setSaving(true);
    try {
      const apiUrl = `${import.meta.env.VITE_API_URL ||
        "http://localhost:3001/api"}/settings`;
      console.log("[Settings] Saving settings to:", apiUrl, settingsData);
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsData),
      });
      const result = await response.json();
      console.log("[Settings] Save response:", result);

      if (result.success) {
        console.log("[Settings] Settings saved successfully");
      }
    } catch (error) {
      console.error("[Settings] Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-600">Configure automation and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Auto Rebalancing */}
        <Card>
          <CardHeader>
            <CardTitle>Auto Rebalancing</CardTitle>
            <CardDescription>
              Automatically rebalance positions when price moves beyond
              threshold
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-rebalance">Enable Auto Rebalancing</Label>
              <Switch
                id="auto-rebalance"
                checked={autoRebalance}
                onCheckedChange={setAutoRebalance}
              />
            </div>

            {autoRebalance && (
              <div className="space-y-2">
                <Label>Rebalance Threshold: {rebalanceThreshold[0]}%</Label>
                <Slider
                  value={rebalanceThreshold}
                  onValueChange={setRebalanceThreshold}
                  min={1}
                  max={20}
                  step={1}
                />
                <p className="text-sm text-gray-500">
                  Rebalance when price is within {rebalanceThreshold[0]}% of
                  range boundary
                </p>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!autoRebalance || saving}
              onClick={() =>
                saveSettings({
                  autoRebalance,
                  rebalanceThreshold: rebalanceThreshold[0],
                })
              }
            >
              {saving ? "Saving..." : "Save Rebalancing Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Auto Fee Collection */}
        <Card>
          <CardHeader>
            <CardTitle>Auto Fee Collection</CardTitle>
            <CardDescription>
              Automatically collect fees when they reach the threshold
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-fees">Enable Auto Collection</Label>
              <Switch
                id="auto-fees"
                checked={autoCollectFees}
                onCheckedChange={setAutoCollectFees}
              />
            </div>

            {autoCollectFees && (
              <div className="space-y-2">
                <Label>Collection Threshold ($)</Label>
                <Input
                  type="number"
                  value={feeThreshold}
                  onChange={(e) => setFeeThreshold(Number(e.target.value))}
                />
                <p className="text-sm text-gray-500">
                  Collect fees when they reach ${feeThreshold}
                </p>
              </div>
            )}

            <Button
              className="w-full"
              disabled={!autoCollectFees || saving}
              onClick={() => saveSettings({ autoCollectFees, feeThreshold })}
            >
              {saving ? "Saving..." : "Save Collection Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Stop Loss */}
        <Card>
          <CardHeader>
            <CardTitle>Stop Loss Protection</CardTitle>
            <CardDescription>
              Automatically close positions to limit losses
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="stop-loss">Enable Stop Loss</Label>
              <Switch
                id="stop-loss"
                checked={stopLossEnabled}
                onCheckedChange={setStopLossEnabled}
              />
            </div>

            {stopLossEnabled && (
              <div className="space-y-2">
                <Label>Loss Threshold: {stopLossThreshold[0]}%</Label>
                <Slider
                  value={stopLossThreshold}
                  onValueChange={setStopLossThreshold}
                  min={5}
                  max={50}
                  step={5}
                />
                <p className="text-sm text-gray-500">
                  Close position if loss exceeds {stopLossThreshold[0]}%
                </p>
              </div>
            )}

            <Button
              className="w-full"
              variant="destructive"
              disabled={!stopLossEnabled || saving}
              onClick={() =>
                saveSettings({
                  stopLossEnabled,
                  stopLossThreshold: stopLossThreshold[0],
                })
              }
            >
              {saving ? "Saving..." : "Save Stop Loss Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Configure alerts and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="notify-rebalance">Rebalance Alerts</Label>
              <Switch id="notify-rebalance" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-fees">Fee Collection Alerts</Label>
              <Switch id="notify-fees" defaultChecked />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="notify-risk">Risk Warnings</Label>
              <Switch id="notify-risk" defaultChecked />
            </div>

            <Button
              className="w-full"
              disabled={saving}
              onClick={() =>
                saveSettings({
                  notifications: { rebalance: true, fees: true, risk: true },
                })
              }
            >
              {saving ? "Saving..." : "Save Notification Settings"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
