"use client";

import { RiskMetrics } from "@/lib/api";

interface RiskMetricsCardProps {
  data: RiskMetrics | null;
  loading: boolean;
}

function MetricRow({
  label,
  value,
  tooltip,
  color,
}: {
  label: string;
  value: string;
  tooltip?: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <span className="text-sm text-gray-600 dark:text-gray-400" title={tooltip}>
        {label}
      </span>
      <span className={`text-sm font-semibold ${color || "text-gray-900 dark:text-gray-100"}`}>
        {value}
      </span>
    </div>
  );
}

export default function RiskMetricsCard({ data, loading }: RiskMetricsCardProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Risikometrikker
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">Beregner...</p>
      </div>
    );
  }

  if (!data || data.error) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Risikometrikker
        </h3>
        <p className="text-gray-400 dark:text-gray-500 text-sm">
          {data?.error || "Ingen data tilgjengelig"}
        </p>
      </div>
    );
  }

  const returnColor =
    data.annual_return_pct >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  const drawdownColor = "text-red-600 dark:text-red-400";

  const sharpeColor =
    data.sharpe_ratio >= 1
      ? "text-green-600 dark:text-green-400"
      : data.sharpe_ratio >= 0.5
        ? "text-yellow-600 dark:text-yellow-400"
        : "text-red-600 dark:text-red-400";

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
        Risikometrikker
      </h3>
      <div>
        <MetricRow
          label="Annualisert avkastning"
          value={`${data.annual_return_pct >= 0 ? "+" : ""}${data.annual_return_pct}%`}
          color={returnColor}
          tooltip="Avkastning omregnet til årlig rate"
        />
        <MetricRow
          label="Annualisert volatilitet"
          value={`${data.annual_volatility_pct}%`}
          tooltip="Standardavvik av daglig avkastning, annualisert"
        />
        <MetricRow
          label="Sharpe ratio"
          value={data.sharpe_ratio.toFixed(2)}
          color={sharpeColor}
          tooltip="Risikojustert avkastning (avkastning - risikofri rente) / volatilitet"
        />
        <MetricRow
          label="Sortino ratio"
          value={data.sortino_ratio.toFixed(2)}
          tooltip="Som Sharpe, men bruker kun nedsidevolatilitet"
        />
        <MetricRow
          label="Maks drawdown"
          value={`${data.max_drawdown_pct}%`}
          color={drawdownColor}
          tooltip="Største fall fra topp til bunn"
        />
        <MetricRow
          label="Beste dag"
          value={`+${data.best_day_pct}%`}
          color="text-green-600 dark:text-green-400"
        />
        <MetricRow
          label="Verste dag"
          value={`${data.worst_day_pct}%`}
          color="text-red-600 dark:text-red-400"
        />
        <MetricRow
          label="Positive dager"
          value={`${data.positive_days_pct}%`}
          tooltip={`${data.trading_days} handelsdager totalt`}
        />
      </div>
    </div>
  );
}
