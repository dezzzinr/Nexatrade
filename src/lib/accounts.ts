// Shared constants/helpers for admin-controlled account standing. Statuses
// are set by admins under Admin panel -> Users and enforced server-side on
// every mutating request so they can't be bypassed from the client.

export const ACCOUNT_STATUSES = ["active", "limited", "suspended", "locked"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export function accountStatusLabel(status: string) {
  switch (status) {
    case "limited": return "Limited";
    case "suspended": return "Suspended";
    case "locked": return "Locked";
    default: return "Active";
  }
}

type StatusFields = {
  accountStatus: string;
  maxTradeAmount: string | number | null;
  withdrawalsBlocked: boolean;
};

// Call before any mutating action (trade, deposit, withdrawal, subscribe,
// configure a bot instance). Returns a friendly error to show the user, or
// null if the action is allowed. `kind` lets "limited" accounts selectively
// block only withdrawals while still allowing everything else.
export function blockedActionMessage(user: StatusFields, kind: "trade" | "deposit" | "withdraw" | "subscribe" | "configure"): string | null {
  const status = user.accountStatus ?? "active";
  if (status === "locked" || status === "suspended") {
    return "Your account is suspended. Contact support for help.";
  }
  if (status === "limited" && kind === "withdraw" && user.withdrawalsBlocked) {
    return "Withdrawals are currently disabled on your account. Contact support for help.";
  }
  return null;
}

// Specifically for the "trade" action, where the limit is a dollar amount
// rather than an outright block. Returns a friendly error, or null if the
// trade's total value is within bounds (or no limit applies).
export function tradeLimitMessage(user: StatusFields, totalValue: number): string | null {
  if (user.accountStatus !== "limited" || user.maxTradeAmount == null) return null;
  const cap = Number(user.maxTradeAmount);
  if (Number.isFinite(cap) && totalValue > cap + 0.0001) {
    return `This account is limited to trades up to $${cap.toFixed(2)}. Contact support to request a higher limit.`;
  }
  return null;
}
