# Applying this update: User profiles, full registration, and region-based currency

This zip contains the full NexaTrade project with a **complete user-profile system, a registration overhaul, and region-based currency conversion** added on top of everything delivered previously (deposits, withdrawals, copy trading, trading bots, plans, admin panel overhaul, trading feature overhaul). Since I don't have push access to your GitHub repo, apply it manually:

## 1. Copy the files into your repo

Copy every file from this zip over your existing project, preserving the folder structure (this is a full project snapshot, not a diff — it's safe to just overwrite):

```bash
# from a fresh copy of your repo
rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='.next' /path/to/unzipped/nexatrade/ /path/to/your/repo/
cd /path/to/your/repo
git status   # review the changes before committing
git add -A
git commit -m "User profiles, registration overhaul, region-based currency conversion"
git push
```

Do **not** overwrite your `.env` — your `DATABASE_URL`, `ADMIN_EMAILS`, and any API keys stay as they are. **No new environment variables are required** for this update; the FX rate lookup (`open.er-api.com`) is free and keyless.

## 2. Apply the new database schema

This update adds the following nullable columns to the existing `users` table — all additive, nothing destructive, no existing rows are touched:

`username, date_of_birth, gender, country, state, city, address, phone, profile_photo, referral_code, security_question, security_answer_hash, terms_accepted_at, privacy_accepted_at, currency`

Apply them with Drizzle:

```bash
npm install
npx drizzle-kit push
```

Review the prompts carefully — it should only be adding columns. Existing accounts (including seeded/demo ones) will simply have these fields as `null` (currency defaults to `"USD"`); users are prompted to fill in their profile from the new Profile page, but nothing is force-blocked.

## 3. Rebuild and redeploy

```bash
npm run build
```

Then redeploy as usual. `npx tsc --noEmit` passes cleanly and `npx eslint .` is clean except for a handful of pre-existing issues in `src/app/page.tsx` / `src/app/admin/page.tsx` that predate this update (mostly a newer stricter React Compiler lint rule flagging `Date.now()` calls during render in long-lived countdown/expiry displays) — none of that is new in this change, and none of it is a runtime bug.

## 4. What's new

- **Registration form overhaul.** Replaces the old name/email/password modal with a two-section form: **Personal Information** (full name\*, date of birth\*, gender, country\*, state/province, city, residential address, phone\*, email\*, profile photo) and **Account Setup** (username\*, password\*, confirm password\*, referral/promo code, security question, security answer, Terms & Conditions\* checkbox, Privacy Policy\* checkbox). `*` = required.
- **Username login.** Users can now log in with either their email or their username.
- **Free-text security question.** Users write their own question and answer (not a preset list) at registration or later from their profile; it powers a self-service "Forgot password" flow (`getSecurityQuestion` → answer → `resetPasswordWithSecurityAnswer`) with no email/SMS infrastructure needed.
- **Full profile page.** View/edit every registration field, re-upload a profile photo (stored as base64, like deposit receipts — no object storage required), change password, change/set the security question, change display currency, and see read-only Terms/Privacy acceptance timestamps + referral code. Pre-existing (seeded/demo) accounts can fill in all the newly-added fields here.
- **Region-based currency, fully converted for display.** Selecting a country at registration sets a derived display currency (editable independently afterwards). The real ledger (balances, trades, transactions) stays USD everywhere internally — this is purely a display-layer conversion using a live USD-based FX rate table, applied to balances, trade prices, portfolio value, P&L, 24h volume, market cap, and chart axes/tooltips across the whole app. Trade amount *inputs* stay USD-denominated (for exact, simple order math) with a small converted-amount hint shown underneath when the user's currency isn't USD.
- **Admin visibility.** A user's username, phone, country, and display currency now show read-only on their detail page in `/admin → Manage users`, next to the existing editable name/email/role fields.
- **Backfill-friendly.** No migration script forces old accounts to fill anything in; every new field is nullable and the app treats missing values as "not set yet," prompting the user from their profile page rather than blocking login.

## 5. Testing it yourself

1. Register a new account — fill in the full two-section form, including a security question/answer and a profile photo. Confirm you land in the app logged in.
2. Log out, then log back in using the **username** you chose instead of the email.
3. Click "Forgot password," enter your username, answer your security question, and set a new password. Try a wrong answer first to confirm it's rejected, then the right answer to confirm the reset works and you can log in with the new password.
4. Open your Profile page: edit a few fields (city, gender, address), change your display currency to something other than USD, and save. Confirm balances/prices across the app (Overview, Markets, Trade) now show in that currency, with the FX rate applied consistently.
5. From the Trade page, note the Amount input still shows USD but now shows a small "≈ [your currency]" hint underneath when your currency isn't USD.
6. Change your password from the Profile page (current + new + confirm), log out, and confirm the new password works and the old one doesn't.
7. As an admin, open **Manage users → [any user]** and confirm their username, phone, country, and display currency show up read-only.
8. Log in as an existing/seeded account created before this update — confirm it still logs in fine and its profile page shows the new fields as blank/"Not set," editable going forward.

No real money, card data, or payment processor is involved anywhere in this app — it remains a paper-trading simulation, as before.
