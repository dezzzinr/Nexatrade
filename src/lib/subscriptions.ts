// Shared subscription-duration constants used by every paid, time-limited
// feature in the app (copy trading, trading bots, and plans). Every
// subscription type uses the same fixed window: pay once, get access for 7
// days, then resubscribe - there is no auto-renewal anywhere in the app.

export const SUBSCRIPTION_DAYS = 7;
export const SUBSCRIPTION_MS = SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000;
