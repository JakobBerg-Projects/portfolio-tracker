"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PortfolioHistoryPoint } from "@/lib/api";

interface PortfolioChartProps {
  data: PortfolioHistoryPoint[];
  currency: "NOK" | "USD";
}

export default function PortfolioChart({ data, currency }: PortfolioChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800 h-80 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">Last opp en CSV for å se porteføljeverdi over tid</p>
      </div>
    );
  }

  const dataKey = currency === "NOK" ? "total_value_nok" : "total_value_usd";

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("nb-NO", { month: "short", day: "numeric" });
  };

  const formatValue = (value: number) =>
    new Intl.NumberFormat("nb-NO", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Porteføljeverdi over tid</h2>
      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid, #f0f0f0)" className="[.dark_&]:stroke-gray-700" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 12 }}
            interval="preserveStartEnd"
            stroke="#9ca3af"
          />
          <YAxis
            tickFormatter={formatValue}
            tick={{ fontSize: 12 }}
            width={120}
            stroke="#9ca3af"
          />
          <Tooltip
            formatter={(value) => [formatValue(Number(value)), "Verdi"]}
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              backgroundColor: "var(--background)",
              border: "1px solid #374151",
              borderRadius: "0.5rem",
              color: "var(--foreground)",
            }}
          />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
