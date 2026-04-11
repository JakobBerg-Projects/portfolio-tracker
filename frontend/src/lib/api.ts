const API_BASE = "";

function authHeaders(): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface Holding {
  id: number;
  name: string;
  ticker: string;
  currency: string;
  quantity: number;
  avg_price: number;
  last_price: number | null;
  value: number | null;
  value_nok: number | null;
  today_pct: number | null;
  return_pct: number | null;
  return_nok: number | null;
}

export interface PortfolioSummary {
  total_value_nok: number;
  total_value_usd: number;
  total_return_nok: number;
  total_return_pct: number;
  holdings_count: number;
}

export interface PortfolioHistoryPoint {
  date: string;
  total_value_nok: number;
  twr_pct: number;
}

export interface Allocation {
  name: string;
  ticker: string;
  value_nok: number;
  percentage: number;
}

export async function uploadCSV(file: File, mode: "replace" | "append" = "replace"): Promise<{ message: string; transaction_count: number }> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/portfolio/upload?mode=${mode}`, {
    method: "POST",
    headers: authHeaders(),
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    let detail = "Upload failed";
    try {
      detail = JSON.parse(text).detail || detail;
    } catch {
      detail = text || detail;
    }
    throw new Error(detail);
  }

  return res.json();
}

export async function getHoldings(): Promise<Holding[]> {
  const res = await fetch(`${API_BASE}/api/portfolio/holdings`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch holdings");
  return res.json();
}

export async function getSummary(): Promise<PortfolioSummary> {
  const res = await fetch(`${API_BASE}/api/portfolio/summary`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

export async function getHistory(period: string = "1y"): Promise<PortfolioHistoryPoint[]> {
  const res = await fetch(`${API_BASE}/api/portfolio/history?period=${period}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function getAllocation(): Promise<Allocation[]> {
  const res = await fetch(`${API_BASE}/api/portfolio/allocation`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch allocation");
  return res.json();
}

// --- Analysis ---

export interface FactorDetail {
  name: string;
  coefficient: number;
  t_stat: number;
  p_value: number;
  significant: boolean;
}

export interface FactorExposure {
  factors: FactorDetail[];
  r_squared: number;
  adj_r_squared: number;
  annual_alpha_pct: number;
  n_observations: number;
  period: string;
  model: string;
  non_us_tickers: string[];
  error?: string;
}

export interface RiskMetrics {
  annual_return_pct: number;
  annual_volatility_pct: number;
  sharpe_ratio: number;
  sortino_ratio: number;
  max_drawdown_pct: number;
  best_day_pct: number;
  worst_day_pct: number;
  positive_days_pct: number;
  trading_days: number;
  period: string;
  error?: string;
}

export interface CorrelationMatrix {
  tickers: string[];
  matrix: number[][];
  avg_correlation: number;
  min_correlation: number;
  max_correlation: number;
  n_observations: number;
  period: string;
  error?: string;
}

export interface ContagionPair {
  ticker_1: string;
  ticker_2: string;
  normal_correlation: number;
  stress_correlation: number;
  change: number;
}

export interface ContagionAnalysis {
  tickers: string[];
  pairs: ContagionPair[];
  avg_normal_correlation: number;
  avg_stress_correlation: number;
  contagion_delta: number;
  stress_days: number;
  normal_days: number;
  stress_threshold_pct: number;
  period: string;
  error?: string;
}

export async function getFactorExposure(period: string = "3y"): Promise<FactorExposure> {
  const res = await fetch(`${API_BASE}/api/analysis/factors?period=${period}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch factor exposure");
  return res.json();
}

export async function getRiskMetrics(period: string = "1y"): Promise<RiskMetrics> {
  const res = await fetch(`${API_BASE}/api/analysis/risk?period=${period}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch risk metrics");
  return res.json();
}

export async function getCorrelationMatrix(period: string = "1y"): Promise<CorrelationMatrix> {
  const res = await fetch(`${API_BASE}/api/analysis/correlation?period=${period}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch correlation matrix");
  return res.json();
}

export async function getContagionAnalysis(period: string = "1y"): Promise<ContagionAnalysis> {
  const res = await fetch(`${API_BASE}/api/analysis/contagion?period=${period}`, { headers: authHeaders() });
  if (!res.ok) throw new Error("Failed to fetch contagion analysis");
  return res.json();
}
