# Applying this update: Admin panel overhaul (user management)

This zip contains the full NexaTrade project with a new **admin user management** feature added on top of everything delivered previously (deposits, withdrawals, copy trading, trading bots, plans). Since I don't have push access to your GitHub repo, apply it manually:

## 1. Copy the files into your repo

Copy every file from this zip over your existing project, preserving the folder structure (this is a full project snapshot, not a diff — it's safe to just overwrite). If you're using git, the simplest approach:

```bash
# from a fresh copy of your repo
rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='.next' /path/to/unzipped/nexatrade/ /path/to/your/repo/
cd /path/to/your/repo
git status   # review the changes before committing
git add -A
git commit -m "Add admin user management (accounts, balances, notifications, manual trades)"
git push
```

Do **not** overwrite your `.env` — your `DATABASE_URL`, `ADMIN_EMAILS`, and CoinGecko keys stay as they are; nothing new is required in `.env` for this update.

## 2. Apply the new database schema

This update adds 5 new columns to `users`, 2 new columns to `trades`, and a new `notifications` table. Apply them with Drizzle:

```bash
npm install
npx drizzle-kit push
```

Review the prompts carefully (it should only be adding columns/tables, nothing destructive). This is additive — no existing data is touched or dropped. If you use versioned migrations instead of `push` in production, generate a migration (`npx drizzle-kit generate`) and review it before applying.

## 3. Rebuild and redeploy

```bash
npm run build
```

Then redeploy as usual (push to `main` for Vercel auto-deploy, or restart your process manager / container).

## 4. What's new

- **Admin → Overview**: platform-wide stats (users, total balance, pending deposits/withdrawals, active subscriptions).
- **Admin → Manage users**: searchable user table, "Add user" to create accounts directly, and a full per-user detail view with:
  - Profile editing (name, email, role)
  - Account standing: lock / suspend / limit (with optional max trade size and/or withdrawal block for "limited"), with an optional reason shown to the user
  - Direct balance editing (always logged as an `admin_credit`/`admin_debit` transaction)
  - Sending a one-off notification to that user (shows in their notification bell)
  - Placing a manual trade on their behalf (defaults to live price, or set a custom fill price) — tagged as "Placed by support" in their trade history
  - Viewing/ending their bot, copy-trading, and plan subscriptions
  - Recent trades, transactions, and deposit/withdrawal requests
- The whole admin panel is now a **sidebar-on-desktop, hamburger-menu-on-mobile** layout, matching the main app exactly, with the existing Deposits/Withdrawals/Deposit destinations/Copy traders/Trading bots/Plans tools unchanged in function (just moved into the new navigation).
- On the main app, users now see: an account-status banner (if limited/suspended), their real notifications in the bell (with mark-as-read), and a "Placed by support" badge on trades an admin placed for them.

## 5. Testing it yourself

1. Make sure `ADMIN_EMAILS` in `.env` includes an email you can register with (e.g. `admin@yoursite.com`).
2. Register that account from the main app (profile menu → Create an account), or log in if it already exists — it's auto-promoted to admin.
3. Go to `/admin` → **Manage users**. Create a second, regular test user (or use one already registered) and try: editing their account standing to "Limited" with a max trade size, sending them a notification, editing their balance, and placing a manual trade. Then log in as that test user to see the effects (status banner, notification bell, trade history badge, transaction history).

No real money, card data, or payment processor is involved anywhere in this app — it remains a paper-trading simulation with an admin-reviewed manual deposit/withdrawal flow, as before.
