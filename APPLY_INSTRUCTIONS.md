# Applying this update: Language selector, tab persistence, and demo-account gating

This zip contains the full NexaTrade project with **three new features** added on top of everything delivered previously (trading overhaul, profit targets, user profiles/registration, region-based currency): a **language selector with live translation**, a fix so **refreshing the app no longer resets you to the Overview tab**, and **demo-account gating** that prompts guests to sign up/log in instead of letting them silently trade/deposit/withdraw/subscribe forever. Since I don't have push access to your GitHub repo, apply it manually:

## 1. Copy the files into your repo

```bash
# from a fresh copy of your repo
rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='.next' /path/to/unzipped/nexatrade/ /path/to/your/repo/
cd /path/to/your/repo
git status   # review the changes before committing
git add -A
git commit -m "Language selector + live translation, tab persistence, demo-account gating"
git push
```

Do **not** overwrite your `.env`. **No new environment variables or API keys are required** — translation uses MyMemory (`api.mymemory.translated.net`), a free, keyless machine-translation API.

## 2. Apply the new database schema

This adds one nullable column and one new table — both additive, nothing destructive:

- `users.language` (text, nullable — defaults to `"en"` when unset)
- `translation_cache` (new table: caches every translated string per language so the translation API is only ever called once per unique string/language combination, across every user forever)

```bash
npm install
npx drizzle-kit push
```

Review the prompts — it should only add a column and a new table.

## 3. Rebuild and redeploy

```bash
npm run build
```

`npx tsc --noEmit` passes cleanly. `npx eslint .` is clean except for a handful of pre-existing issues in `src/app/page.tsx` (a stricter React Compiler lint rule flagging `Date.now()` calls during render in long-lived countdown/expiry displays, and a couple of `set-state-in-effect` warnings in data-loading effects) — these all predate this update and are not runtime bugs.

## 4. What's new

### Language selector & live translation
- A **globe icon** in the topbar opens a language popover with 8 languages: English, Español, Français, Português, العربية, हिन्दी, 中文, Русский.
- Language **always defaults to English** and is **only ever changed manually** by the user (never auto-detected from country, unlike currency) — matching your explicit instruction.
- Signed-in users also get a **"Display language" selector on the Profile page** (next to Display currency); picking a language there or from the topbar syncs both ways and persists to the user's account, so it carries across devices/browsers. Guests/demo users get a local-only choice (nothing to persist to).
- Translation is produced by a **live free translation API at runtime** (MyMemory) — not a hand-written dictionary. Every translated string is cached forever in the new `translation_cache` table, so the API is called at most once per unique string per language, no matter how many users switch to that language.
- **Known limitation of the free API:** MyMemory is a translation-memory lookup service, not a dedicated LLM translator, so very short/ambiguous UI words (e.g. a bare "Trade" or "Portfolio" with no surrounding sentence) occasionally come back as an imprecise or oddly-matched translation, and the anonymous tier has a modest daily quota shared across all users of this API key-less endpoint. The app is built to degrade gracefully — any string that fails to translate (quota hit, network hiccup, etc.) simply falls back to showing the original English text rather than breaking the UI. If you want higher quality/limits later, this is a one-function swap (`src/lib/translate-server.ts` → `translateOne`) to a paid provider (DeepL, Google Cloud Translation, Azure Translator, etc.) with no other code changes needed.
- Translation scope was intentionally focused on navigation, the topbar, all page headings/descriptions, and the full login/register/forgot-password/demo-upgrade flows — the chrome a user sees first and most often. Deep page content (individual table columns, every button, admin panel) stays in English for now, same scoping boundary used for the earlier currency-conversion work.

### "Refresh shouldn't start over"
- The active tab (Overview, Markets, Trade, etc.) is now remembered in `localStorage` and restored automatically on refresh, so reloading the page (or coming back later, as long as you're still logged in) drops you back where you left off instead of resetting to Overview. The initial render always starts at "Overview" (matching what the server renders) and the saved tab is adopted a moment later in a client-only effect, so this doesn't cause a React hydration mismatch.

### Demo-account gating
- Demo/guest users can still **browse everything freely** — dashboards, markets, charts, bot/plan/copy-trader catalogs are all unrestricted, same as before.
- The moment a demo user tries to **do** something that would normally create data (quick/market trade, limit/stop/margin order, deposit, withdrawal, or subscribing to a bot/copy-trader/plan), a **"Create a free account to continue"** modal appears instead, with **Sign up free**, **Sign in**, and **Keep exploring** options. This is enforced both client-side (immediate modal, friendly UX) and **server-side** (`src/lib/accounts.ts` → `blockedActionMessage`, so it can't be bypassed by calling the API directly).
- The same modal also appears automatically after a demo user has been browsing for about **2 minutes**, as a proactive nudge — even if they never attempt a mutating action.

## 5. Testing it yourself

1. **Language:** Click the globe icon in the topbar, pick a non-English language, and confirm the sidebar, topbar, and page headings translate within a few seconds. Refresh the page — the choice should stick. If you're logged in (not demo), go to Profile → Display language and confirm it shows the same selection, and that switching it there updates the topbar too.
2. **Tab persistence:** Navigate to any tab other than Overview (e.g. Markets), refresh the browser, and confirm you land back on Markets instead of Overview.
3. **Demo gating (action attempt):** Open the app without logging in (you're a demo user by default), go to Deposit, fill in an amount, and submit — confirm the "Create a free account to continue" modal appears instead of the deposit going through. Try the same from Trade, Withdraw, Trading Bot, Copy Trading, and Plans.
4. **Demo gating (time-based):** Stay on the app as a demo user without clicking anything mutating for about 2 minutes — confirm the same modal pops up on its own.
5. **Demo browsing unaffected:** As a demo user, confirm you can still freely view Markets, Trading Bot/Copy Trading/Plans catalogs, your (seeded) Overview dashboard, etc. without being interrupted.
6. Confirm a **real** (non-demo) account is never shown the demo-gate modal and can trade/deposit/withdraw/subscribe normally.

No real money, card data, or payment processor is involved anywhere in this app — it remains a paper-trading simulation, as before.
