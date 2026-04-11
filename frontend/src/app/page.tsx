"use client";

import { useState, useCallback } from "react";
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
import { useCurrency } from "@/lib/currency-context";

export default function Home() {
  const { currency } = useCurrency();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [allocation, setAllocation] = useState<Allocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

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

    setRefreshKey((k) => k + 1);
  }, []);

  return (
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
  );
}
