import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "./market.css";

export const metadata: Metadata = {
  title: "NexaTrade — Crypto Paper Trading",
  description: "A modern crypto paper trading workspace to explore markets, manage a portfolio, and test strategies with simulated funds.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
