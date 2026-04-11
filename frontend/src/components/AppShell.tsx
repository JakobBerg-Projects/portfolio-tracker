"use client";

import { ReactNode } from "react";
import Navigation from "./Navigation";
import { useCurrency } from "@/lib/currency-context";

export default function AppShell({ children }: { children: ReactNode }) {
  const { currency, setCurrency } = useCurrency();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Navigation currency={currency} onCurrencyChange={setCurrency} />
      {children}
    </div>
  );
}
