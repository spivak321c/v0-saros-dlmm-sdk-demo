import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { Slider } from "@/components/ui/slider";
import { TrendingUp, DollarSign, Zap, ArrowRight } from "lucide-react";

export default function Simulator() {
  const navigate = useNavigate();
  const [lowerPrice, setLowerPrice] = useState(170);
  const [upperPrice, setUpperPrice] = useState(190);
  const [currentPrice] = useState(180);
  const [amount, setAmount] = useState(1000);
  const [volatility, setVolatility] = useState([50]);

  const calculateProjections = () => {
    const rangeWidth = ((upperPrice - lowerPrice) / currentPrice) * 100;
    const dailyFees =
      amount * 0.002 * (100 / rangeWidth) * (volatility[0] / 50);
    const monthlyFees = dailyFees * 30;
    const yearlyFees = dailyFees * 365;
    const apr = (yearlyFees / amount) * 100;

    return {
      dailyFees: dailyFees.toFixed(2),
      monthlyFees: monthlyFees.toFixed(2),
      yearlyFees: yearlyFees.toFixed(2),
      apr: apr.toFixed(2),
      rangeWidth: rangeWidth.toFixed(1),
    };
  };

  const projections = calculateProjections();

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
          Strategy Simulator
        </h1>
        <p className="text-muted-foreground">
          Test different position strategies and estimate potential returns
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Position Parameters</CardTitle>
            <CardDescription>Configure your position settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="amount">Investment Amount ($)</Label>
              <Input
                id="amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="lower">Lower Price ($)</Label>
              <Input
                id="lower"
                type="number"
                value={lowerPrice}
                onChange={(e) => setLowerPrice(Number(e.target.value))}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="upper">Upper Price ($)</Label>
              <Input
                id="upper"
                type="number"
                value={upperPrice}
                onChange={(e) => setUpperPrice(Number(e.target.value))}
                min={0}
              />
            </div>

            <div className="space-y-2">
              <Label>Market Volatility: {volatility[0]}%</Label>
              <Slider
                value={volatility}
                onValueChange={setVolatility}
                min={0}
                max={100}
                step={5}
                className="mt-2"
              />
              <p className="text-xs text-muted-foreground">
                Higher volatility = more trading volume = higher fees
              </p>
            </div>

            <div className="pt-4 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current Price</span>
                <span className="font-medium">${currentPrice}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-muted-foreground">Range Width</span>
                <span className="font-medium">{projections.rangeWidth}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projections */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Projected Returns</CardTitle>
              <CardDescription>
                Estimated fee earnings based on your parameters
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Daily Fees</p>
                  <p className="text-2xl font-bold text-success">
                    ${projections.dailyFees}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Monthly Fees</p>
                  <p className="text-2xl font-bold text-success">
                    ${projections.monthlyFees}
                  </p>
                </div>
              </div>

              <div className="pt-4 border-t space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Yearly Fees
                  </span>
                  <span className="text-lg font-semibold">
                    ${projections.yearlyFees}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Estimated APR
                  </span>
                  <span className="text-lg font-semibold text-success">
                    {projections.apr}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-primary mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Optimization Tips</p>
                    <ul className="text-xs text-muted-foreground space-y-1">
                      <li>
                        • Narrower ranges earn more fees but risk going out of
                        range
                      </li>
                      <li>
                        • Higher volatility increases trading volume and fee
                        potential
                      </li>
                      <li>
                        • Monitor positions regularly to maintain optimal ranges
                      </li>
                    </ul>
                  </div>
                </div>

                <Button
                  onClick={() => navigate("/positions")}
                  className="w-full gap-2"
                >
                  Create Position
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Disclaimer</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">
                These projections are estimates based on your input parameters
                and historical data. Actual returns may vary significantly based
                on market conditions, trading volume, and price movements.
                Always do your own research and never invest more than you can
                afford to lose.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
