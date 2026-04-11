"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface CurrencyContextValue {
  currency: "NOK" | "USD";
  setCurrency: (c: "NOK" | "USD") => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "NOK",
  setCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<"NOK" | "USD">("NOK");
  return (
    <CurrencyContext.Provider value={{ currency, setCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
