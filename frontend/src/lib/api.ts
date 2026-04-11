const API_BASE = "";

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
  total_value_usd: number;
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
  const res = await fetch(`${API_BASE}/api/portfolio/holdings`);
  if (!res.ok) throw new Error("Failed to fetch holdings");
  return res.json();
}

export async function getSummary(): Promise<PortfolioSummary> {
  const res = await fetch(`${API_BASE}/api/portfolio/summary`);
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

export async function getHistory(period: string = "1y"): Promise<PortfolioHistoryPoint[]> {
  const res = await fetch(`${API_BASE}/api/portfolio/history?period=${period}`);
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function getAllocation(): Promise<Allocation[]> {
  const res = await fetch(`${API_BASE}/api/portfolio/allocation`);
  if (!res.ok) throw new Error("Failed to fetch allocation");
  return res.json();
}
