import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, holdings, trades, transactions, bots, copiedTraders, subscriptions } from "@/db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { getUser, createDemoUser, setSession } from "@/lib/auth";
import { getAsset, marketPrice } from "@/lib/market";
import { getMarketSnapshot } from "@/lib/market-server";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

export async function GET(request: NextRequest) {
  try {
    let user = await getUser(request);
    let fresh = false;
    if (!user) { user = await createDemoUser(); fresh = true; }
    const [h, t, tx, b, c, p] = await Promise.all([
      db.select().from(holdings).where(eq(holdings.userId, user.id)),
      db.select().from(trades).where(eq(trades.userId, user.id)).orderBy(desc(trades.createdAt)).limit(50),
      db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(50),
      db.select().from(bots).where(eq(bots.userId, user.id)).orderBy(desc(bots.createdAt)),
      db.select().from(copiedTraders).where(eq(copiedTraders.userId, user.id)),
      db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).orderBy(desc(subscriptions.createdAt)).limit(1),
    ]);
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, isDemo: user.isDemo, role: user.role, cashBalance: Number(user.cashBalance) }, holdings: h, trades: t, transactions: tx, bots: b, copiedTraders: c, plan: p[0]?.plan ?? "Starter" });
    if (fresh) await setSession(response, user.id);
    return response;
  } catch (error) { console.error("App GET:", error); return bad("Unable to load your workspace. Please try again.", 500); }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const body = await request.json();
    const action = String(body.action ?? "");
    const amount = Number(body.amount);
    const validAmount = Number.isFinite(amount) && amount > 0 && amount <= 10000000 && Math.abs(Math.round(amount * 100) - amount * 100) < 0.000001;

    if (action === "trade") {
      const symbol = String(body.symbol ?? "").toUpperCase();
      const side = body.side;
      const quantity = Number(body.quantity);
      if (!getAsset(symbol) || !["buy", "sell"].includes(side) || !Number.isFinite(quantity) || quantity <= 0 || quantity > 1000000 || quantity.toString().split(".")[1]?.length > 8) return bad("Enter a valid trade quantity.");
      const market = await getMarketSnapshot();
      const asset = market.assets.find((item) => item.symbol === symbol);
      if (market.status !== "live" || !asset || asset.price <= 0) return bad("Live market pricing is unavailable. Paper trading is paused until prices recover.", 503);
      const total = Math.round(quantity * asset.price * 100) / 100;
      if (total < 0.01) return bad("Minimum trade value is $0.01.");
      await db.transaction(async (tx) => {
        const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
        const [existing] = await tx.select().from(holdings).where(and(eq(holdings.userId, user.id), eq(holdings.symbol, symbol))).for("update");
        if (side === "buy") {
          if (Number(wallet.cashBalance) < total) throw new Error("Insufficient available balance.");
          await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${total}` }).where(eq(users.id, user.id));
          if (existing) {
            const oldQty = Number(existing.quantity);
            const newQty = oldQty + quantity;
            const avgPrice = ((oldQty * Number(existing.avgPrice)) + quantity * asset.price) / newQty;
            await tx.update(holdings).set({ quantity: newQty.toFixed(8), avgPrice: avgPrice.toFixed(8) }).where(eq(holdings.id, existing.id));
          } else await tx.insert(holdings).values({ userId: user.id, symbol, quantity: quantity.toFixed(8), avgPrice: asset.price.toFixed(8) });
        } else {
          if (!existing || Number(existing.quantity) + 0.000000001 < quantity) throw new Error("Insufficient asset balance.");
          await tx.update(users).set({ cashBalance: sql`${users.cashBalance} + ${total}` }).where(eq(users.id, user.id));
          const remaining = Number(existing.quantity) - quantity;
          if (remaining < 0.00000001) await tx.delete(holdings).where(eq(holdings.id, existing.id));
          else await tx.update(holdings).set({ quantity: remaining.toFixed(8) }).where(eq(holdings.id, existing.id));
        }
        await tx.insert(trades).values({ userId: user.id, symbol, side, quantity: quantity.toFixed(8), price: asset.price.toFixed(8), total: total.toFixed(2) });
      });
      return NextResponse.json({ success: true, price: asset.price, total, message: `${side === "buy" ? "Bought" : "Sold"} ${quantity} ${symbol} at ${marketPrice(asset.price)}` });
    }
    if (action === "withdrawal") return bad("Withdrawals now require admin review. Go to Withdraw to get started.");
    if (action === "deposit") return bad("Deposits now require submitting a payment receipt for admin review. Go to Deposit to get started.");
    if (action === "createBot") {
      if (!validAmount || amount < 10 || !["DCA", "Grid", "Momentum"].includes(body.strategy)) return bad("Choose a strategy and an allocation of at least $10.");
      await db.insert(bots).values({ userId: user.id, name: `${body.strategy} ${body.symbol && getAsset(body.symbol) ? body.symbol : "BTC"} Bot`, strategy: body.strategy, amount: amount.toFixed(2), active: true });
      return NextResponse.json({ success: true, message: "Trading bot created. This is a paper-trading simulation." });
    }
    if (action === "toggleBot") {
      const [bot] = await db.select().from(bots).where(and(eq(bots.id, String(body.id)), eq(bots.userId, user.id))).limit(1);
      if (!bot) return bad("Bot not found.", 404);
      await db.update(bots).set({ active: !bot.active }).where(eq(bots.id, bot.id));
      return NextResponse.json({ success: true, message: bot.active ? "Bot paused" : "Bot activated" });
    }
    if (action === "copy") {
      const key = String(body.traderKey ?? "");
      if (!["olivia", "marcus", "sophia", "daniel"].includes(key)) return bad("Trader not found.");
      const [existing] = await db.select().from(copiedTraders).where(and(eq(copiedTraders.userId, user.id), eq(copiedTraders.traderKey, key))).limit(1);
      if (existing) { await db.delete(copiedTraders).where(eq(copiedTraders.id, existing.id)); return NextResponse.json({ success: true, message: "Stopped copying trader" }); }
      if (!validAmount || amount < 10) return bad("Enter an allocation of at least $10.");
      await db.insert(copiedTraders).values({ userId: user.id, traderKey: key, amount: amount.toFixed(2) });
      return NextResponse.json({ success: true, message: "Trader added to your copy list" });
    }
    if (action === "plan") {
      const plan = String(body.plan ?? "");
      const prices: Record<string, number> = { Starter: 0, Pro: 29, Elite: 79 };
      if (!(plan in prices)) return bad("Invalid plan.");
      const [current] = await db.select().from(subscriptions).where(eq(subscriptions.userId, user.id)).orderBy(desc(subscriptions.createdAt)).limit(1);
      if ((current?.plan ?? "Starter") === plan) return bad("You are already on this plan.");
      await db.transaction(async (tx) => {
        if (prices[plan] > 0) {
          const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
          if (Number(wallet.cashBalance) < prices[plan]) throw new Error("Insufficient available balance.");
          await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${prices[plan]}` }).where(eq(users.id, user.id));
          await tx.insert(transactions).values({ userId: user.id, type: "plan", amount: prices[plan].toFixed(2), description: `${plan} plan subscription (simulation)` });
        }
        await tx.insert(subscriptions).values({ userId: user.id, plan });
      });
      return NextResponse.json({ success: true, message: `You're now on the ${plan} plan` });
    }
    return bad("Unknown action.");
  } catch (error) { console.error("App POST:", error); return bad(error instanceof Error ? error.message : "Something went wrong.", 400); }
}
