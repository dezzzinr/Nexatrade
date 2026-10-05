import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, holdings, trades, transactions, planSubscriptions, plans } from "@/db/schema";
import { desc, eq, and, sql, gt } from "drizzle-orm";
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
    const [h, t, tx, currentPlan] = await Promise.all([
      db.select().from(holdings).where(eq(holdings.userId, user.id)),
      db.select().from(trades).where(eq(trades.userId, user.id)).orderBy(desc(trades.createdAt)).limit(50),
      db.select().from(transactions).where(eq(transactions.userId, user.id)).orderBy(desc(transactions.createdAt)).limit(50),
      db.select({ planName: plans.name, expiresAt: planSubscriptions.expiresAt })
        .from(planSubscriptions)
        .innerJoin(plans, eq(planSubscriptions.planId, plans.id))
        .where(and(eq(planSubscriptions.userId, user.id), gt(planSubscriptions.expiresAt, new Date())))
        .orderBy(desc(planSubscriptions.startedAt))
        .limit(1),
    ]);
    const response = NextResponse.json({ user: { id: user.id, name: user.name, email: user.email, isDemo: user.isDemo, role: user.role, cashBalance: Number(user.cashBalance) }, holdings: h, trades: t, transactions: tx, plan: currentPlan[0]?.planName ?? null, planExpiresAt: currentPlan[0]?.expiresAt ?? null });
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
    if (action === "createBot" || action === "toggleBot") return bad("Trading bots now require a paid 7-day subscription. Go to Trading Bot to subscribe and configure one.");
    if (action === "copy") return bad("Copy trading now uses paid 7-day subscriptions. Go to Copy Trading to subscribe.");
    if (action === "plan") return bad("Plans now use paid weekly subscriptions. Go to Plans to subscribe.");
    return bad("Unknown action.");
  } catch (error) { console.error("App POST:", error); return bad(error instanceof Error ? error.message : "Something went wrong.", 400); }
}
