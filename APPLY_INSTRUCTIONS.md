# Applying this update: Trading feature overhaul (order types, candlesticks, leverage)

This zip contains the full NexaTrade project with a **complete trading-feature overhaul** added on top of everything delivered previously (deposits, withdrawals, copy trading, trading bots, plans, admin panel). Since I don't have push access to your GitHub repo, apply it manually:

## 1. Copy the files into your repo

Copy every file from this zip over your existing project, preserving the folder structure (this is a full project snapshot, not a diff — it's safe to just overwrite):

```bash
# from a fresh copy of your repo
rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='.next' /path/to/unzipped/nexatrade/ /path/to/your/repo/
cd /path/to/your/repo
git status   # review the changes before committing
git add -A
git commit -m "Trading overhaul: order types, candlestick charts, leverage/margin trading"
git push
```

Do **not** overwrite your `.env` — your `DATABASE_URL`, `ADMIN_EMAILS`, and CoinGecko keys stay as they are; nothing new is required in `.env` for this update.

## 2. Apply the new database schema

This update adds two new tables, **`orders`** (pending/filled/cancelled limit, stop-loss, and take-profit orders) and **`positions`** (leveraged long/short margin positions), plus a nullable `order_id` foreign key on the existing `trades` table so a filled order links back to the trade it produced. Apply them with Drizzle:

```bash
npm install
npx drizzle-kit push
```

Review the prompts carefully (it should only be adding tables/columns, nothing destructive). This is additive — no existing data is touched or dropped. If you use versioned migrations instead of `push` in production, generate a migration (`npx drizzle-kit generate`) and review it before applying.

## 3. Rebuild and redeploy

```bash
npm run build
```

Then redeploy as usual (push to `main` for Vercel auto-deploy, or restart your process manager / container). Note: a full `next build` is memory-hungry — if it's slow or gets killed on a small VM, that's a resource constraint of that machine, not a code issue; it builds fine on normal-sized hardware (Vercel, a 2GB+ droplet, etc.). `npx tsc --noEmit` passes cleanly and is a faster sanity check if you just want to confirm the TypeScript compiles.

## 4. What's new

- **Candlestick charts.** The Trade page's line chart is replaced with an OHLC candlestick chart plus a volume bar strip, with 24H/7D/30D/1Y intervals and a hover tooltip. Backed by a new `/api/market/candles` route built on CoinGecko's `market_chart` endpoint.
- **Full order types.** Spot trading now supports **Market**, **Limit**, **Stop-Loss**, and **Take-Profit** orders (Stop-Loss/Take-Profit are sell-side only, matching real exchanges). Pending orders show in an **Open orders** panel on the Trade page and can be cancelled anytime. A background sweep — piggy-backed onto the existing `/api/market` and `/api/app` traffic, no extra cron needed — checks every open order against the live price and fills it automatically when triggered.
- **No fees, no slippage.** Every fill is exact and deterministic: market orders fill at the live price; limit orders fill at the better of your limit and the live price (never worse); stop-loss/take-profit fill at exactly their trigger price. Zero trading fees anywhere.
- **Leverage / margin trading.** A new **Margin** tab next to Spot lets users open isolated-margin **long or short** positions at 2x–100x leverage, with a live liquidation-price preview, optional take-profit/stop-loss, and live unrealized P&L while open. Liquidation is automatic and capped at losing exactly the posted margin — never more.
- **Trade History** now has three tabs — **Trades**, **Orders**, and **Positions** — each with its own stats cards and a full table of that user's history.
- **Reservation safety.** Placing a sell order (or opening a position) reserves the underlying asset/cash so it can't be double-spent by a market trade or another pending order while it's open; this is enforced on every trade-executing endpoint, not just the new order-ticket one.
- Admin manual trade placement (from the admin panel) intentionally stays spot/market-only — it was not extended to pending order types or leveraged positions.

## 5. Testing it yourself

1. Log in as a regular user and go to **Trade**.
2. Try a **Limit** buy below the current price — it should sit in "Open orders" until the price reaches it (or cancel it manually).
3. Try a **Limit** buy *above* the current price — it should fill immediately, at the live price (not your limit), since that's the better price for you.
4. Buy a small amount of an asset, then place a **Stop-Loss** sell order on it — confirm you can no longer market-sell more of that asset than you have left unreserved.
5. Switch to the **Margin** tab, open a small leveraged long or short position, watch its live P&L update, then close it manually (or set a tight take-profit/stop-loss and let the price trigger it).
6. Check **Trade History → Orders** and **→ Positions** to see the full history with status pills and realized P&L.

No real money, card data, or payment processor is involved anywhere in this app — it remains a paper-trading simulation, as before. Leverage and order types are fully simulated; there is no real exchange connectivity.
