"use client";

import { useState, useEffect, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { getHistory, PortfolioHistoryPoint } from "@/lib/api";

const PERIODS = [
  { key: "1d", label: "I dag" },
  { key: "5d", label: "1 uke" },
  { key: "1mo", label: "1 mnd" },
  { key: "3mo", label: "3 mnd" },
  { key: "ytd", label: "I år" },
  { key: "1y", label: "1 år" },
  { key: "3y", label: "3 år" },
  { key: "5y", label: "5 år" },
  { key: "max", label: "Maks" },
];

interface PortfolioChartProps {
  currency: "NOK" | "USD";
  hasHoldings: boolean;
  refreshKey: number;
}

function formatCurrency(value: number, currency: string): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export default function PortfolioChart({
  currency,
  hasHoldings,
  refreshKey,
}: PortfolioChartProps) {
  const [period, setPeriod] = useState("1y");
  const [data, setData] = useState<PortfolioHistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasHoldings) return;

    let cancelled = false;
    setLoading(true);
    getHistory(period)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [period, hasHoldings, refreshKey]);

  const periodInfo = useMemo(() => {
    if (data.length < 1) return null;
    const first = data[0];
    const last = data[data.length - 1];
    return {
      twrPct: last.twr_pct,
      lastValue: last.total_value_nok,
      returnNok: first.total_value_nok * (last.twr_pct / 100),
    };
  }, [data]);

  const isPositive = (periodInfo?.twrPct ?? 0) >= 0;
  const lineColor = isPositive ? "#22c55e" : "#ef4444";

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (["1d", "5d"].includes(period)) {
      return d.toLocaleDateString("nb-NO", {
        day: "numeric",
        month: "short",
      });
    }
    if (["1mo", "3mo"].includes(period)) {
      return d.toLocaleDateString("nb-NO", {
        day: "numeric",
        month: "short",
      });
    }
    return d.toLocaleDateString("nb-NO", {
      month: "short",
      year: "2-digit",
    });
  };

  if (!hasHoldings) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800 h-[430px] flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">
          Last opp en CSV for å se porteføljeverdi over tid
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      {/* Header with value and TWR */}
      <div className="mb-4">
        <h2 className="text-sm text-gray-500 dark:text-gray-400">
          Porteføljeverdi
        </h2>
        {periodInfo ? (
          <>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {formatCurrency(periodInfo.lastValue, currency)}
            </p>
            <p
              className={`text-sm font-medium ${
                isPositive
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {periodInfo.returnNok >= 0 ? "+" : ""}
              {formatCurrency(periodInfo.returnNok, currency)} ({formatPct(periodInfo.twrPct)})
            </p>
          </>
        ) : loading ? (
          <p className="text-2xl font-bold text-gray-300 dark:text-gray-600">
            ...
          </p>
        ) : (
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            -
          </p>
        )}
      </div>

      {/* Period selector */}
      <div className="flex gap-1 mb-4 overflow-x-auto">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              period === p.key
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      {loading ? (
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-gray-400 dark:text-gray-500">
            Henter kurshistorikk...
          </p>
        </div>
      ) : data.length === 0 ? (
        <div className="h-[300px] flex items-center justify-center">
          <p className="text-gray-400 dark:text-gray-500">
            Ingen data for valgt periode
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#e5e7eb"
              className="[.dark_&]:stroke-gray-700"
            />
            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 12 }}
              interval="preserveStartEnd"
              stroke="#9ca3af"
            />
            <YAxis
              tickFormatter={(v) => `${v.toFixed(1)}%`}
              tick={{ fontSize: 12 }}
              width={70}
              stroke="#9ca3af"
              domain={["auto", "auto"]}
            />
            <ReferenceLine y={0} stroke="#6b7280" strokeDasharray="3 3" />
            <Tooltip
              formatter={(value) => [formatPct(Number(value)), "Avkastning"]}
              labelFormatter={(label) =>
                new Date(String(label)).toLocaleDateString("nb-NO", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              }
              contentStyle={{
                backgroundColor: "var(--background)",
                border: "1px solid #374151",
                borderRadius: "0.5rem",
                color: "var(--foreground)",
              }}
            />
            <Line
              type="monotone"
              dataKey="twr_pct"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
