"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Navigation from "./Navigation";
import { useCurrency } from "@/lib/currency-context";
import { useAuth } from "@/lib/auth-context";

export default function AppShell({ children }: { children: ReactNode }) {
  const { currency, setCurrency } = useCurrency();
  const { user, loading } = useAuth();
  const pathname = usePathname();

  // Show nothing while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400 dark:text-gray-500">Laster...</p>
      </div>
    );
  }

  // Login page renders without shell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // Redirect to login if not authenticated
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors">
      <Navigation currency={currency} onCurrencyChange={setCurrency} />
      {children}
    </div>
  );
}
