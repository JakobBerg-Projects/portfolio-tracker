"use client";

import { PortfolioSummary } from "@/lib/api";

interface SummaryCardsProps {
  summary: PortfolioSummary | null;
  currency: "NOK" | "USD";
}

function formatNumber(value: number, currency: string): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function SummaryCards({ summary, currency }: SummaryCardsProps) {
  if (!summary) return null;

  const totalValue =
    currency === "NOK" ? summary.total_value_nok : summary.total_value_usd;

  const cards = [
    {
      label: "Porteføljeverdi",
      value: formatNumber(totalValue, currency),
    },
    {
      label: "Urealisert gevinst",
      value: formatNumber(summary.total_return_nok, "NOK"),
      sub: `${summary.total_return_pct >= 0 ? "+" : ""}${summary.total_return_pct}%`,
      color: summary.total_return_nok >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
    },
    {
      label: "Antall beholdninger",
      value: summary.holdings_count.toString(),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800"
        >
          <p className="text-sm text-gray-500 dark:text-gray-400">{card.label}</p>
          <p className={`text-2xl font-bold mt-1 ${card.color || "text-gray-900 dark:text-gray-100"}`}>
            {card.value}
          </p>
          {card.sub && (
            <p className={`text-sm mt-1 ${card.color || ""}`}>{card.sub}</p>
          )}
        </div>
      ))}
    </div>
  );
}
