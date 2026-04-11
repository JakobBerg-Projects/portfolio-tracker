"use client";

import { useState, useCallback, useEffect } from "react";
import CSVUpload from "@/components/CSVUpload";
import SummaryCards from "@/components/SummaryCards";
import PortfolioChart from "@/components/PortfolioChart";
import AllocationPie from "@/components/AllocationPie";
import HoldingsTable from "@/components/HoldingsTable";
import PortfolioTreemap from "@/components/PortfolioTreemap";
import {
  getHoldings,
  getSummary,
  getAllocation,
  Holding,
  PortfolioSummary,
  Allocation,
} from "@/lib/api";

export default function Home() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [allocation, setAllocation] = useState<Allocation[]>([]);
  const [currency, setCurrency] = useState<"NOK" | "USD">("NOK");
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleDark = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };

  const refreshData = useCallback(async () => {
    setLoading(true);
    try {
      const [h, s, a] = await Promise.all([
        getHoldings(),
        getSummary(),
        getAllocation(),
      ]);
      setHoldings(h);
      setSummary(s);
      setAllocation(a);
    } catch (e) {
      console.error("Failed to load data:", e);
    } finally {
      setLoading(false);
    }

    // Bump refreshKey so PortfolioChart refetches
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Porteføljeanalyse
          </h1>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              <button
                onClick={() => setCurrency("NOK")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  currency === "NOK"
                    ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                NOK
              </button>
              <button
                onClick={() => setCurrency("USD")}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  currency === "USD"
                    ? "bg-white dark:bg-gray-700 shadow text-gray-900 dark:text-gray-100"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                USD
              </button>
            </div>
            <button
              onClick={toggleDark}
              className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Toggle dark mode"
            >
              {dark ? (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <CSVUpload onUploadSuccess={refreshData} />

        {loading && (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">Laster data...</p>
          </div>
        )}

        {summary && summary.holdings_count > 0 && (
          <>
            <SummaryCards summary={summary} currency={currency} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PortfolioChart
                currency={currency}
                hasHoldings={summary.holdings_count > 0}
                refreshKey={refreshKey}
              />
              <AllocationPie data={allocation} />
            </div>

            <PortfolioTreemap holdings={holdings} />

            <HoldingsTable holdings={holdings} />
          </>
        )}
      </main>
    </div>
  );
}
