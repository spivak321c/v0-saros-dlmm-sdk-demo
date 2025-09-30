"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Line } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js"

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface VolatilityChartProps {
  data: {
    timestamp: number
    price: number
  }[]
  poolName: string
}

export function VolatilityChart({ data, poolName }: VolatilityChartProps) {
  const chartData = {
    labels: data.map((d) => new Date(d.timestamp).toLocaleTimeString()),
    datasets: [
      {
        label: "Price",
        data: data.map((d) => d.price),
        borderColor: "rgb(59, 130, 246)",
        backgroundColor: "rgba(59, 130, 246, 0.1)",
        fill: true,
        tension: 0.4,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
      },
      tooltip: {
        mode: "index" as const,
        intersect: false,
      },
    },
    scales: {
      y: {
        beginAtZero: false,
        grid: {
          color: "rgba(0, 0, 0, 0.05)",
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          maxRotation: 0,
          autoSkip: true,
          maxTicksLimit: 6,
        },
      },
    },
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Price Volatility</CardTitle>
        <CardDescription className="text-xs sm:text-sm">{poolName} - Last 50 data points</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[200px] sm:h-[300px]">
          <Line data={chartData} options={options} />
        </div>
      </CardContent>
    </Card>
  )
}
