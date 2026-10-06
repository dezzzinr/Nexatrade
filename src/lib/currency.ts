// Client-side currency display helpers. Every dollar amount in the app's
// data model (balances, prices, P&L, transactions) is stored and computed in
// USD; these helpers only convert *how it's displayed* to the signed-in
// user's preferred currency, using a USD -> currency rate supplied by the
// server (see src/lib/fx-server.ts). Nothing here should ever be used for
// ledger math - only for rendering text.

const SYMBOL_FALLBACKS: Record<string, string> = {
  // A handful of common currencies where Intl's default long form is more
  // verbose than most trading UIs use; everything else falls back to
  // Intl.NumberFormat's own currency formatting (which is correct, just
  // sometimes uses "NGN 1,200" instead of "₦1,200").
  NGN: "₦", GBP: "£", EUR: "€", USD: "$", JPY: "¥", INR: "₹", KRW: "₩",
};

export function currencySymbol(currency: string): string {
  return SYMBOL_FALLBACKS[currency.toUpperCase()] ?? currency.toUpperCase() + " ";
}

function fmt(amount: number, currency: string, options: Intl.NumberFormatOptions): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), ...options }).format(amount);
  } catch {
    // Unknown/unsupported currency code - fall back to a plain prefixed number.
    return currencySymbol(currency) + amount.toLocaleString("en-US", { minimumFractionDigits: options.minimumFractionDigits ?? 2, maximumFractionDigits: options.maximumFractionDigits ?? 2 });
  }
}

// General money amounts (balances, totals, transactions).
export function formatMoney(amountUSD: number, currency: string, rate: number, digits = 2): string {
  if (!Number.isFinite(amountUSD)) return "—";
  return fmt(amountUSD * (Number.isFinite(rate) && rate > 0 ? rate : 1), currency, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Asset/market prices - needs more precision for sub-$1 (or sub-unit)
// assets, based on the *converted* magnitude so it reads naturally in any
// currency.
export function formatMarketPrice(amountUSD: number, currency: string, rate: number): string {
  if (!(amountUSD > 0) || !Number.isFinite(amountUSD)) return "—";
  const effectiveRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
  const converted = amountUSD * effectiveRate;
  const digits = converted >= 1 ? 2 : converted >= 0.1 ? 4 : converted >= 0.0001 ? 6 : 8;
  return fmt(converted, currency, { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

// Compact notation for big numbers (market cap, volume, etc.)
export function formatCompactMoney(amountUSD: number, currency: string, rate: number): string {
  if (!Number.isFinite(amountUSD) || amountUSD <= 0) return "—";
  return fmt(amountUSD * (Number.isFinite(rate) && rate > 0 ? rate : 1), currency, { notation: "compact", maximumFractionDigits: 2 });
}
