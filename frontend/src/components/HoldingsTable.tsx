"use client";

import { useMemo, useState } from "react";
import { Holding } from "@/lib/api";

interface HoldingsTableProps {
  holdings: Holding[];
}

type SortKey = keyof Holding;
type SortDir = "asc" | "desc";

function formatNum(value: number | null, decimals: number = 2): string {
  if (value === null || value === undefined) return "-";
  return new Intl.NumberFormat("nb-NO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

const columns: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "name", label: "Navn", align: "left" },
  { key: "ticker", label: "Ticker", align: "left" },
  { key: "currency", label: "Valuta", align: "right" },
  { key: "quantity", label: "Antall", align: "right" },
  { key: "avg_price", label: "GAV", align: "right" },
  { key: "last_price", label: "Siste kurs", align: "right" },
  { key: "value", label: "Verdi", align: "right" },
  { key: "value_nok", label: "Verdi NOK", align: "right" },
  { key: "today_pct", label: "I dag %", align: "right" },
  { key: "return_pct", label: "Avkast. %", align: "right" },
  { key: "return_nok", label: "Avkast. NOK", align: "right" },
];

export default function HoldingsTable({ holdings }: HoldingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("value_nok");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(() => {
    return [...holdings].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      let cmp: number;
      if (typeof av === "string" && typeof bv === "string") {
        cmp = av.localeCompare(bv, "nb-NO");
      } else {
        cmp = (av as number) - (bv as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [holdings, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(typeof holdings[0]?.[key] === "string" ? "asc" : "desc");
    }
  };

  if (holdings.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800">
        <p className="text-gray-400 dark:text-gray-500 text-center">Ingen beholdninger. Last opp en CSV-fil.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow border border-gray-100 dark:border-gray-800 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800">
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={() => handleSort(col.key)}
                className={`px-4 py-3 font-semibold text-gray-900 dark:text-gray-100 cursor-pointer select-none hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  col.align === "right" ? "text-right" : "text-left"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {col.label}
                  {sortKey === col.key && (
                    <span className="text-blue-500">{sortDir === "asc" ? "\u25B2" : "\u25BC"}</span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((h) => (
            <tr key={h.ticker} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{h.name}</td>
              <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{h.ticker}</td>
              <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{h.currency}</td>
              <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{formatNum(h.quantity, 0)}</td>
              <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{formatNum(h.avg_price)}</td>
              <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{formatNum(h.last_price)}</td>
              <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{formatNum(h.value)}</td>
              <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                {formatNum(h.value_nok, 0)}
              </td>
              <td
                className={`px-4 py-3 text-right ${
                  (h.today_pct ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {h.today_pct !== null ? `${h.today_pct >= 0 ? "+" : ""}${formatNum(h.today_pct)}%` : "-"}
              </td>
              <td
                className={`px-4 py-3 text-right ${
                  (h.return_pct ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {h.return_pct !== null ? `${formatNum(h.return_pct)}%` : "-"}
              </td>
              <td
                className={`px-4 py-3 text-right ${
                  (h.return_nok ?? 0) >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatNum(h.return_nok, 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
