"use client";

import { useState, useEffect } from "react";
import RiskMetricsCard from "@/components/RiskMetricsCard";
import FactorExposureCard from "@/components/FactorExposureCard";
import CorrelationMatrixCard from "@/components/CorrelationMatrixCard";
import ContagionCard from "@/components/ContagionCard";
import {
  getRiskMetrics,
  getFactorExposure,
  getCorrelationMatrix,
  getContagionAnalysis,
  getSummary,
  RiskMetrics,
  FactorExposure,
  CorrelationMatrix,
  ContagionAnalysis,
} from "@/lib/api";

const PERIODS = [
  { key: "1mo", label: "1 mnd" },
  { key: "3mo", label: "3 mnd" },
  { key: "ytd", label: "I år" },
  { key: "1y", label: "1 år" },
  { key: "3y", label: "3 år" },
  { key: "5y", label: "5 år" },
  { key: "max", label: "Maks" },
];

export default function AnalysisPage() {
  const [period, setPeriod] = useState("1y");
  const [risk, setRisk] = useState<RiskMetrics | null>(null);
  const [factors, setFactors] = useState<FactorExposure | null>(null);
  const [correlation, setCorrelation] = useState<CorrelationMatrix | null>(null);
  const [contagion, setContagion] = useState<ContagionAnalysis | null>(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [loadingFactors, setLoadingFactors] = useState(false);
  const [loadingCorrelation, setLoadingCorrelation] = useState(false);
  const [loadingContagion, setLoadingContagion] = useState(false);
  const [hasHoldings, setHasHoldings] = useState<boolean | null>(null);

  useEffect(() => {
    getSummary()
      .then((s) => setHasHoldings(s.holdings_count > 0))
      .catch(() => setHasHoldings(false));
  }, []);

  useEffect(() => {
    if (!hasHoldings) return;

    setLoadingRisk(true);
    setLoadingFactors(true);

    getRiskMetrics(period)
      .then(setRisk)
      .catch(() => setRisk(null))
      .finally(() => setLoadingRisk(false));

    getFactorExposure(period)
      .then(setFactors)
      .catch(() => setFactors(null))
      .finally(() => setLoadingFactors(false));

    setLoadingCorrelation(true);
    getCorrelationMatrix(period)
      .then(setCorrelation)
      .catch(() => setCorrelation(null))
      .finally(() => setLoadingCorrelation(false));

    setLoadingContagion(true);
    getContagionAnalysis(period)
      .then(setContagion)
      .catch(() => setContagion(null))
      .finally(() => setLoadingContagion(false));
  }, [period, hasHoldings]);

  if (hasHoldings === null) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <p className="text-gray-400 dark:text-gray-500">Laster...</p>
      </main>
    );
  }

  if (!hasHoldings) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow p-6 border border-gray-100 dark:border-gray-800 flex items-center justify-center h-[300px]">
          <p className="text-gray-400 dark:text-gray-500">
            Last opp en CSV på Oversikt-siden for å se porteføljeanalyse
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Porteføljeanalyse
        </h2>
        <div className="flex gap-1">
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RiskMetricsCard data={risk} loading={loadingRisk} />
        <FactorExposureCard data={factors} loading={loadingFactors} />
      </div>

      <CorrelationMatrixCard data={correlation} loading={loadingCorrelation} />
      <ContagionCard data={contagion} loading={loadingContagion} />
    </main>
  );
}
