# Applying this update: Notification system (in-app + email)

This zip contains the full NexaTrade project with a **full notification system** added on top of everything delivered previously (trading overhaul, profit targets, user profiles/registration, region-based currency, language selector, tab persistence, demo-account gating). Every notable account/trading event now creates an **in-app notification** (the bell icon) and, for real accounts that opt in, an **email** via Resend. Since I don't have push access to your GitHub repo, apply it manually:

## 1. Copy the files into your repo

```bash
# from a fresh copy of your repo
rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='.next' /path/to/unzipped/nexatrade/ /path/to/your/repo/
cd /path/to/your/repo
git status   # review the changes before committing
git add -A
git commit -m "Notification system: in-app + email, per-user email toggle"
git push
```

Do **not** overwrite your `.env`.

## 2. Apply the new database schema

Additive only, nothing destructive:

- `notifications.type` (text, defaults to `"admin_message"` for existing rows) — the event category, used to pick an icon in the bell.
- `notifications.email_status` / `notifications.email_error` (text, nullable) — outcome of trying to email that notification (`sent` / `failed` / `skipped` / `disabled` / `stubbed` / `null`).
- `users.email_notifications` (boolean, defaults to `true`) — the per-user "email me about activity" toggle on Profile.

```bash
npm install
npx drizzle-kit push
```

## 3. (Optional, recommended) Turn on real email

Out of the box, email sending is **stubbed**: every email is logged to the server console instead of actually sent, so the whole feature works with zero configuration (in-app notifications always work regardless). To send real emails:

1. Create a free account at [resend.com](https://resend.com) and generate an API key.
2. Add to `.env`:
   ```
   RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
   ```
3. That's it — no other code changes needed, it activates automatically.

Two things worth knowing about Resend's **free tier** (no verified custom domain):
- You must send **from** `onboarding@resend.dev` (the default `EMAIL_FROM` in this project already uses that).
- You can only **receive** mail at the email address you signed up to Resend with — Resend blocks sending to other addresses until you verify your own domain. For a real multi-user production launch, verify a domain in Resend and set `EMAIL_FROM` to an address on it; then any user's email works.

Optionally also set `APP_URL` (your deployed URL) so notification emails include a working "Open NexaTrade" button; on Vercel this is auto-detected from `VERCEL_URL` if `APP_URL` isn't set.

## 4. Rebuild and redeploy

```bash
npm run build
```

`npx tsc --noEmit` passes cleanly. `npx eslint .` is clean except for the same handful of pre-existing issues in `src/app/page.tsx` that predate this update (not runtime bugs, previously documented).

## 5. What's new

### In-app notifications (the bell icon)
Every notable event now creates a notification, each with a distinct icon/color in the bell:

| Event | Example |
|---|---|
| Account created, sign-in, password/security question changed | "Welcome to NexaTrade!", "New sign-in to your account" |
| Trade placed, order placed/filled/cancelled | "Bought BTC", "Limit order placed", "Buy order filled" |
| Position opened, closed (manual), auto-closed (take-profit/stop-loss/liquidation) | "Opened 5x long BTC position", "Liquidated: BTC position" |
| Deposit submitted/approved/rejected, withdrawal submitted/approved/rejected | "Deposit approved" |
| Bot/copy-trader/plan subscribed, and cancelled by an admin | "Subscribed to BTC DCA Starter" |
| Admin credits/debits your balance, or changes your account status | "Balance credited", "Your account status changed" |
| A direct message from an admin (existing feature, now also emailed) | whatever the admin writes |

### Email notifications
- Every one of the events above is also emailed — **except** two purely self-initiated actions the user already saw confirmed on screen (cancelling your own order, manually closing your own position), which stay in-app only to avoid noise.
- **Every sign-in always emails**, by design — a security-relevant event users should know about even if they don't check the app.
- Emails are sent via **Resend**, with a clean branded HTML template shared across every event type (`src/lib/email-server.ts`).
- Sending is **deferred** using Next.js's `after()` so it never slows down the request that triggered it — important since position liquidations/order fills can notify *other* users in the background while someone else's page is loading.
- Skipped automatically for: demo accounts (no email on file), accounts with no email, and any user who has turned the toggle off (see below).

### Per-user email toggle (Profile → Notifications)
- A single on/off switch: "Email me about account activity." In-app notifications in the bell can never be turned off (so there's always a full activity record), but email is optional and defaults to **on**.
- This is deliberately a simple toggle, not granular per-category preferences — flip it off and every email stops; flip it on and all future notable events are emailed again.

## 6. Testing it yourself

1. **Register** a new account — confirm a "Welcome to NexaTrade!" notification appears in the bell, and (with `RESEND_API_KEY` set) an email arrives.
2. **Log out and log back in** — confirm a "New sign-in" notification + email fires every time.
3. **Place a trade, a limit order, open a leveraged position** — confirm each creates its own distinct notification with the right icon.
4. **Cancel an order / manually close a position** — confirm these show up in the bell but do *not* attempt an email (check the server console / database `email_status` column, which should be `null` for these two types).
5. **Submit a deposit or withdrawal, then approve/reject it from the admin panel** — confirm the submitter gets notified at each step, not the admin.
6. **Subscribe to a bot/copy trader/plan, then cancel it from Admin → Users → that user's subscriptions** — confirm both the subscribe and the cancel notify the user, with the right product name.
7. **Toggle "Email me about account activity" off on Profile**, then trigger any event — confirm it still appears in the bell but the database's `notifications.email_status` is `disabled` instead of `sent`/`stubbed`.
8. Without `RESEND_API_KEY` set, confirm the server console logs `[email:stub] ...` lines instead of errors, and the app keeps working normally end to end.

No real money, card data, or payment processor is involved anywhere in this app — it remains a paper-trading simulation, as before.
