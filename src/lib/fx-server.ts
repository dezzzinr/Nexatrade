// Foreign-exchange rate fetching for the "display amounts in the user's
// currency" feature. The ledger (cash balances, trades, orders, positions,
// transactions) is always stored and computed in USD - this module only
// supplies a USD -> target-currency multiplier used purely for display
// formatting on the client. Rates come from a free, keyless public API and
// are cached in-process with a stale-while-revalidate fallback, mirroring
// the pattern used for CoinGecko market data in market-server.ts.

export type FxSnapshot = {
  base: "USD";
  rates: Record<string, number>; // USD -> currency multiplier, e.g. rates.NGN = 1331
  status: "live" | "stale" | "unavailable";
  updatedAt: string | null;
};

const FX_URL = "https://open.er-api.com/v6/latest/USD";
const REVALIDATE_SECONDS = 60 * 60; // FX moves slowly; refresh hourly
const STALE_AFTER_MS = 26 * 60 * 60 * 1000; // allow the previous day's rate to keep serving if the provider is briefly down

let lastGood: { rates: Record<string, number>; updatedAt: string } | null = null;

export async function getFxSnapshot(): Promise<FxSnapshot> {
  try {
    const response = await fetch(FX_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`FX provider returned ${response.status}`);
    const data = await response.json();
    const rates = data?.rates;
    if (!rates || typeof rates !== "object" || typeof rates.USD !== "number") throw new Error("Invalid FX response");
    const updatedAt = new Date().toISOString();
    lastGood = { rates, updatedAt };
    return { base: "USD", rates, status: "live", updatedAt };
  } catch (error) {
    console.error("FX snapshot unavailable:", error instanceof Error ? error.message : error);
    if (lastGood && Date.now() - Date.parse(lastGood.updatedAt) < STALE_AFTER_MS) {
      return { base: "USD", rates: lastGood.rates, status: "stale", updatedAt: lastGood.updatedAt };
    }
    return { base: "USD", rates: { USD: 1 }, status: "unavailable", updatedAt: null };
  }
}

// Convenience helper for server routes that only need one currency's rate.
export async function getFxRate(currency: string): Promise<{ rate: number; status: FxSnapshot["status"]; updatedAt: string | null }> {
  const snapshot = await getFxSnapshot();
  const code = (currency || "USD").toUpperCase();
  if (code === "USD") return { rate: 1, status: snapshot.status, updatedAt: snapshot.updatedAt };
  const rate = snapshot.rates[code];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    // Currency not covered by the provider (e.g. KPW) - fall back to USD
    // 1:1 rather than showing a broken/zero amount.
    return { rate: 1, status: "unavailable", updatedAt: snapshot.updatedAt };
  }
  return { rate, status: snapshot.status, updatedAt: snapshot.updatedAt };
}
