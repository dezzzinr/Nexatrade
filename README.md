# NexaTrade

A crypto paper-trading web app built with Next.js App Router, Drizzle ORM, and PostgreSQL. Visitors can explore immediately in a seeded demo workspace or create an account with their own persistent simulation balance.

## Connect to Neon

Create a Neon PostgreSQL database and set `DATABASE_URL` in `.env` to the connection string from the Neon dashboard (a pooled connection string is supported):

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST.neon.tech/DBNAME?sslmode=require"
```

Then install dependencies, apply the schema, seed the starter catalog, and start the app:

```bash
npm install
npx drizzle-kit push
npm run seed
npm run dev
```

The app and Drizzle both read the same `DATABASE_URL`; no credentials are embedded in the source. `npm run seed` (`scripts/seed.mjs`) is idempotent — safe to re-run — and inserts the 10 starter trading bots and 4 starter plans described below only if they don't already exist, so admins are free to edit/delete/add to the catalog afterwards without the seed re-adding anything.

## Deploy to Vercel + Neon

1. **Create a Neon database.** In the [Neon Console](https://console.neon.tech/), create a project. Click **Connect** and copy the complete **pooled** PostgreSQL connection string (including `sslmode=require`). This app uses the Node.js `pg` driver, so keep its API routes on the default Node.js runtime, not Edge.
2. **Create the tables before deploying.** Set `DATABASE_URL` in your local `.env` to that Neon URL (see `.env.example`). In the project directory, run:

   ```bash
   npm install
   npx drizzle-kit push
   npm run seed
   ```

   `drizzle-kit push` uses the `DATABASE_URL` in your local `.env`. Double-check that it points to the intended Neon database. This is suitable for the first deployment; for subsequent production schema changes, review changes and use versioned migrations rather than blindly pushing to a live database. `npm run seed` populates the starter trading bot and plan catalogs (see below) — it's idempotent, so it's safe to run again later if you ever want to top it back up.
3. **Push this project to GitHub.** Create an empty GitHub repository, then run the commands below in the project directory if it is not already a Git repository:

   ```bash
   git init
   git add .
   git commit -m "Deploy NexaTrade"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/nexatrade.git
   git push -u origin main
   ```

   Replace the repository URL with yours. `.gitignore` excludes `.env` and build artifacts; **never commit database passwords**. If you previously committed `.env`, remove it from Git history and rotate the Neon password.
4. **Import the repository in [Vercel](https://vercel.com/new).** Choose **Add New → Project**, import your GitHub repo, and leave the auto-detected **Next.js** framework and default build command (`npm run build`). In **Environment Variables**, add `DATABASE_URL` with the same Neon pooled URL for **Production**. Add `COINGECKO_API_KEY` with a free CoinGecko Demo key for more reliable live prices (see below). Alternatively, connect a Neon database via Vercel Storage's Neon integration, which injects `DATABASE_URL` automatically. For Preview deployments, use a separate Neon branch/database instead of sharing production data.
5. **Click Deploy.** Open `https://YOUR-PROJECT.vercel.app/api/health` and confirm it returns `{"ok":true}`. Then open the site, register, and try a paper trade. If health returns `500`, check Vercel's `DATABASE_URL`, Neon connectivity, and that step 2 created the tables. Adding or changing an environment variable on Vercel requires redeployment to reach existing deployments.

Future pushes to `main` automatically deploy through Vercel. If you change the schema, apply that change to the appropriate Neon database as part of the release before relying on new tables/columns.

## Live market data

NexaTrade reads USD spot market prices, 24-hour and 7-day changes, 7-day sparklines, coin artwork, volumes, market caps, and 24-hour high/low from the [CoinGecko API](https://www.coingecko.com/en/api). The 24H, 7D, 30D, and 1Y charts use CoinGecko historical prices. The browser refreshes the market snapshot every 60 seconds; the server caches provider responses to limit API usage. **Prices are indicative, not an exchange order book or tick-by-tick streaming feed.**

Keyless access may work for local evaluation but is rate-limited by shared IP. For deployment, create a free **Demo API key** in the [CoinGecko Developer Dashboard](https://www.coingecko.com/en/developers/dashboard) and set `COINGECKO_API_KEY` in your local `.env` and in Vercel's environment variables. This is read **only on the server** and sent as the `x-cg-demo-api-key` header. Paid Pro keys can instead be provided as `COINGECKO_PRO_API_KEY`; the app uses the appropriate Pro host and header. Do not expose a key using `NEXT_PUBLIC_`.

The current market snapshot is available at `/api/market`; chart data at `/api/market/chart?symbol=BTC&period=7D`. When provider data is unavailable, old quotes may display as **stale**, but paper trading is paused until fresh quotes return. Portfolio historical charts estimate the value of **today's positions** using past market prices; they are not a ledger-based record of actual historical account value. Market-signal cards reflect observed market momentum and 24-hour ranges, not advice or trading instructions.

## Features

- Registration and login with salted password hashes and HTTP-only database-backed sessions
- Live market data, coin images, interactive historical charts, and paper-trading dashboard
- Portfolio valuation, server-verified simulated buy/sell execution, and trade history
- Manual, admin-reviewed deposits and withdrawals with a transaction ledger (see below)
- Admin-managed trading bot catalog with paid 7-day subscriptions and user-configured bot instances
- Admin-managed copy traders with paid 7-day subscriptions
- Admin-managed subscription plans with paid 7-day (weekly) subscriptions and per-plan feature lists
- Market observations, and a seed script (`npm run seed`) that populates 10 starter bots and 4 starter plans
- Responsive interface using the NexaTrade blue theme

**Simulation notice:** Market prices are real provider quotes, but there is no live exchange execution, autonomous bot execution, or automatic trade copying — subscribing to a trading bot or copy trader grants access to configure it / view their published stats for 7 days, it does not execute real trades or mirror real trades. Plan subscriptions are a simulated billing flow and do not enable any live exchange connectivity. Deposits and withdrawals model a real-world manual payment flow — see below.

## Deposits: manual, admin-reviewed (no payment processor)

Deposits are **not instant and not automatic**. The flow is designed for a business that collects payments outside the app (crypto wallets, bank transfers, PayPal, Cash App, gift cards) and credits balances manually after verifying proof of payment:

1. An admin configures one or more **destination accounts** per method (e.g. a BTC address, a bank account, a PayPal email, a $Cashtag, gift-card instructions) under **Admin panel → Deposit destinations** (`/admin`).
2. A user opens **Deposit**, picks a method, sees the destination to pay into, sends funds *outside* NexaTrade through their own banking/wallet/PayPal/etc., then submits an amount, optional reference, optional note, and a **receipt** (screenshot/photo/PDF, up to 3MB) through the app.
3. The request is stored as `pending` and the user's balance is **untouched**. It shows up for the user under "Your deposit requests" and for admins under **Admin panel → Deposit requests**.
4. An admin opens the receipt, then **Approves** (credits the claimed amount to the user's balance and logs a transaction) or **Rejects** (with a required reason shown to the user). Each request can only be reviewed once.

No card numbers, bank credentials, or payment processor are ever handled by the app — it only stores the receipt file and the destination account admins choose to publish, so there is nothing resembling PCI-scoped data to protect. Receipts are stored as base64 in Postgres to avoid needing extra object-storage infrastructure; if you expect large volumes of large files, swap `receiptData` in `src/db/schema.ts` for a pointer to S3/Vercel Blob/etc. instead (see `src/lib/deposits.ts` for the current size/type limits).

## Withdrawals: manual, admin-reviewed, pay-out to any platform

Withdrawals mirror the deposit flow but run in reverse — the user picks where **they** want to be paid instead of an admin-configured destination:

1. A user opens **Withdraw**, picks a payout method (Cryptocurrency, Bank transfer, PayPal, Cash App, Gift card, or **Other** for anything not listed), and enters where to send the money (their own wallet address, bank details, email, $Cashtag, etc.) plus an amount and optional note.
2. On submission the requested amount is **immediately held** — deducted from the user's available cash balance — so it can't be spent on a trade or withdrawn twice while the request is pending. The request appears under "Your withdrawal requests" and for admins under **Admin panel → Withdrawal requests**.
3. The admin manually sends the payout to the destination the user provided (outside the app, using whatever rails that method requires), then either:
   - **Approves** — finalizes the request and logs it in the transaction ledger. No further balance change happens since the amount was already held.
   - **Rejects** (with a required reason shown to the user) — the held amount is automatically refunded back to the user's available balance.

Each request can only be reviewed once, and nothing is ever paid out automatically — approving only marks that the admin already sent the funds manually.

## Copy trading: admin-managed traders, 7-day paid subscriptions

Copy trading is fully admin-curated — there is no seeded or hardcoded trader roster:

1. An admin adds traders under **Admin panel → Copy traders** (`/admin`), setting their name, handle, avatar color, focus (e.g. "BTC, ETH"), risk level (Low/Moderate/High), reported return %, win rate, and — required — the **subscription price** charged for a 7-day subscription.
2. Users browse the roster on the **Copy Trading** page, which shows each trader's stats, price, and a live **active subscribers** count (computed in real time from non-expired subscriptions, not an admin-entered vanity number).
3. Clicking **Subscribe** charges the trader's current price from the user's paper-trading cash balance (free/$0 traders can be subscribed to with no charge) and logs a `subscription` transaction. The subscription starts immediately and **expires in exactly 7 days** — there is no auto-renewal; users resubscribe once it lapses.
4. A user can only hold one active subscription per trader at a time; re-subscribing before expiry is blocked with a friendly message showing when it unlocks again. Past and current subscriptions are listed in a "My subscriptions" history panel with countdowns.
5. Admins can edit a trader's profile/stats/price at any time (price changes only affect future subscriptions — past subscriptions keep the price that was charged at the time), toggle them active/hidden, or delete them. Deleting is blocked with a clear message if the trader has subscription history; deactivate instead to retire them while preserving records.

## Trading bots: admin-managed catalog, 7-day paid subscriptions, user-configured instances

Like copy trading, the bot catalog is fully admin-curated — `npm run seed` only provides a starting lineup; admins can add, edit, deactivate, or remove bots at any time from **Admin panel → Trading bots** (`/admin`):

1. An admin adds a bot under **Admin panel → Trading bots**, setting its name, description, strategy (DCA, Grid, Momentum, Scalping, Rebalancing, or Yield), risk level (Low/Moderate/High), minimum allocation, and — required — the **subscription price** charged for a 7-day subscription.
2. Users browse the catalog on the **Trading Bot** page, which shows each bot's strategy/risk/minimum allocation, price, and a live **active subscribers** count. Clicking **Subscribe** charges the bot's current price from the user's paper-trading cash balance and starts a 7-day, non-renewing subscription (same pattern as copy trading) — users resubscribe once it lapses to keep configuring/running that bot.
3. Once subscribed, a user can **configure any number of bot instances** for that bot product — e.g. one instance trading BTC and a separate instance trading ETH, each with its own allocation amount and optional name — for as long as the subscription stays active. Instances can be paused/resumed or deleted independently under "My bots"; pausing/deleting does not refund or cancel the underlying subscription.
4. If a bot subscription expires, its existing instances are flagged "Needs resubscribe" and can't be reactivated until the user subscribes again; they are not auto-deleted, so resubscribing picks up existing configurations.
5. Admins can edit a bot's profile/price at any time (price changes only affect future subscriptions), toggle active/hidden, or delete it. Deleting is blocked with a clear message if the bot has subscription history; deactivate instead to retire it while preserving records.

**Seeded starter catalog (10 bots):** Stablecoin Yield Bot ($5/wk, Yield, Low risk), BTC DCA Starter ($9/wk, DCA, Low), Conservative DCA Plus ($12/wk, DCA, Low), ETH Grid Trader ($15/wk, Grid, Moderate), Multi-Asset Rebalancer ($19/wk, Rebalancing, Moderate), Swing Trader AI ($22/wk, Momentum, Moderate), Momentum Surge ($25/wk, Momentum, High), Altcoin Momentum Hunter ($29/wk, Momentum, High), BTC Grid Pro ($35/wk, Grid, Moderate), Scalper Bot ($39/wk, Scalping, High).

## Plans: admin-managed tiers, 7-day (weekly) paid subscriptions

Subscription plans follow the same admin-curated pattern — `npm run seed` provides 4 starter tiers, but admins fully control pricing and feature lists from **Admin panel → Plans** (`/admin`):

1. An admin adds a plan under **Admin panel → Plans**, setting its name, description, weekly price, a feature list (one feature per line), an optional "Most popular" featured flag, and a sort order controlling display order.
2. Users browse tiers on the **Plans** page and click **Choose** to subscribe weekly; the price is charged from the user's cash balance and the subscription runs for exactly 7 days, same non-renewing pattern as bots/copy trading. Users may switch plans at any time; re-choosing the plan that is already their current active one is blocked until it lapses.
3. The "current plan" shown throughout the app (topbar, Plans page) is whichever plan has the most recently started still-active subscription; a user with no active plan subscription is shown "No active plan" rather than a hardcoded default tier.
4. A "My plan subscriptions" history table shows past and current plan subscriptions with their price, start date, and expiry.
5. Admins can edit a plan's price/description/features/feature order/featured flag at any time (price changes only affect future subscriptions), toggle active/hidden, or delete it. Deleting is blocked with a clear message if the plan has subscription history; deactivate instead to retire it while preserving records.

**Seeded starter catalog (4 plans):** Starter ($0/wk — Paper trading dashboard, Market overview, Portfolio tracking, Basic trade history), Pro ($15/wk, featured — adds Trading bot subscriptions, Copy trading subscriptions, Advanced market signals, Priority insights), Elite ($35/wk — adds Unlimited bot instances, All trading signals, Advanced portfolio analytics, VIP experience), Institutional ($75/wk — adds Dedicated account concierge, Early access to new bots & traders, Custom portfolio reporting, Priority support response).

### Creating your first admin

There is no admin by default. Set `ADMIN_EMAILS` (comma-separated) in your `.env` / Vercel environment variables to the email address(es) that should have admin access, e.g.:

```env
ADMIN_EMAILS="you@example.com"
```

Registering or logging in with a matching email automatically promotes that account to the `admin` role (see `src/lib/auth.ts`). Admins get an **Admin panel** link in their profile menu, or can go directly to `/admin`.
