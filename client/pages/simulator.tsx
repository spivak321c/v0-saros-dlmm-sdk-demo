import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

export default function Simulator() {
  const navigate = useNavigate();
  const [lowerPrice, setLowerPrice] = useState(170);
  const [upperPrice, setUpperPrice] = useState(190);
  const [currentPrice] = useState(180);
  const [amount, setAmount] = useState(1000);
  const [volatility, setVolatility] = useState([50]);

  const handleCreatePosition = () => {
    console.log('[Simulator] Navigating to positions page to create position');
    navigate('/positions');
  };

  const calculateProjections = () => {
    const rangeWidth = ((upperPrice - lowerPrice) / currentPrice) * 100;
    const dailyFees = (amount * 0.002 * (100 / rangeWidth)) * (volatility[0] / 50);
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Strategy Simulator</h1>
        <p className="text-gray-600">Test different position strategies</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Position Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Investment Amount ($)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Lower Price ($)</Label>
              <Input
                type="number"
                value={lowerPrice}
                onChange={(e) => setLowerPrice(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Upper Price ($)</Label>
              <Input
                type="number"
                value={upperPrice}
                onChange={(e) => setUpperPrice(Number(e.target.value))}
              />
            </div>

            <div className="space-y-2">
              <Label>Expected Volatility: {volatility[0]}%</Label>
              <Slider
                value={volatility}
                onValueChange={setVolatility}
                min={10}
                max={100}
                step={5}
              />
            </div>

            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-800">
                <p>Current Price: ${currentPrice}</p>
                <p>Range Width: {projections.rangeWidth}%</p>
                <p className={currentPrice >= lowerPrice && currentPrice <= upperPrice ? 'text-green-600' : 'text-red-600'}>
                  {currentPrice >= lowerPrice && currentPrice <= upperPrice ? 'In Range ✓' : 'Out of Range ✗'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projections */}
        <Card>
          <CardHeader>
            <CardTitle>Projected Returns</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Daily Fees</span>
                <span className="text-xl font-bold text-green-600">${projections.dailyFees}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Monthly Fees</span>
                <span className="text-xl font-bold text-green-600">${projections.monthlyFees}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <span className="text-gray-600">Yearly Fees</span>
                <span className="text-xl font-bold text-green-600">${projections.yearlyFees}</span>
              </div>

              <div className="flex justify-between items-center p-4 bg-blue-50 rounded-lg border-2 border-blue-200">
                <span className="text-blue-800 font-medium">Estimated APR</span>
                <span className="text-2xl font-bold text-blue-600">{projections.apr}%</span>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-sm text-gray-500 mb-4">
                * Projections are estimates based on current market conditions and may vary
              </p>
              <Button className="w-full" onClick={handleCreatePosition}>Create This Position</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
