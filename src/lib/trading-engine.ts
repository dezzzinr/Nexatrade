// Server-only trading engine: executes spot fills, and sweeps open orders /
// open leverage positions against live prices to fire pending limit/
// stop-loss/take-profit fills, take-profit/stop-loss closes, and
// liquidations.
//
// There is no persistent background worker in this app (it runs as
// serverless Next.js routes), so triggers are evaluated opportunistically:
// - Every GET /api/market call (polled by any open browser tab) sweeps ALL
//   users' open orders/positions, rate-limited to roughly once every 20s
//   per server instance so rapid polling doesn't hammer the database.
// - Every GET /api/app call additionally sweeps just the requesting user,
//   so their own dashboard/trade page always reflects fresh fills the
//   instant they load it, even if the global sweep hasn't run yet.
// - Placing a new order/position immediately checks itself once, so e.g. a
//   limit buy placed at/above the current price fills right away instead
//   of waiting for the next sweep, exactly like a real exchange.
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { holdings, orders, positions, trades, transactions, users } from "@/db/schema";
import { spotOrderShouldFill, spotOrderFillPrice, positionCloseEvent, realizedPnl, type PendingOrderType } from "@/lib/trading";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// --- Spot fill execution (shared by manual market orders, pending-order
// fills, and the engine sweep) -------------------------------------------

export async function executeSpotFill(
  tx: Tx,
  userId: string,
  symbol: string,
  side: "buy" | "sell",
  quantity: number,
  price: number,
  orderId?: string,
): Promise<number> {
  const total = Math.round(quantity * price * 1e8) / 1e8; // keep cent precision below
  const roundedTotal = Math.round(total * 100) / 100;
  const [wallet] = await tx.select().from(users).where(eq(users.id, userId)).for("update");
  const [existing] = await tx.select().from(holdings).where(and(eq(holdings.userId, userId), eq(holdings.symbol, symbol))).for("update");
  if (side === "buy") {
    if (Number(wallet.cashBalance) + 0.000001 < roundedTotal) throw new Error("Insufficient available balance.");
    await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${roundedTotal}` }).where(eq(users.id, userId));
    if (existing) {
      const oldQty = Number(existing.quantity);
      const newQty = oldQty + quantity;
      const avgPrice = (oldQty * Number(existing.avgPrice) + quantity * price) / newQty;
      await tx.update(holdings).set({ quantity: newQty.toFixed(8), avgPrice: avgPrice.toFixed(8) }).where(eq(holdings.id, existing.id));
    } else {
      await tx.insert(holdings).values({ userId, symbol, quantity: quantity.toFixed(8), avgPrice: price.toFixed(8) });
    }
  } else {
    if (!existing || Number(existing.quantity) + 0.000000001 < quantity) throw new Error("Insufficient asset balance.");
    await tx.update(users).set({ cashBalance: sql`${users.cashBalance} + ${roundedTotal}` }).where(eq(users.id, userId));
    const remaining = Number(existing.quantity) - quantity;
    if (remaining < 0.00000001) await tx.delete(holdings).where(eq(holdings.id, existing.id));
    else await tx.update(holdings).set({ quantity: remaining.toFixed(8) }).where(eq(holdings.id, existing.id));
  }
  await tx.insert(trades).values({
    userId,
    symbol,
    side,
    quantity: quantity.toFixed(8),
    price: price.toFixed(8),
    total: roundedTotal.toFixed(2),
    orderId: orderId ?? null,
  });
  return roundedTotal;
}

// --- Reservation helpers: how much of a user's cash/holdings is already
// committed to other open orders, so a new order can't be placed against
// funds/assets that are already spoken for. --------------------------------

export async function reservedBuyCash(tx: Tx, userId: string): Promise<number> {
  const rows = await tx.select({ quantity: orders.quantity, price: orders.triggerPrice })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.side, "buy"), eq(orders.status, "open")));
  return rows.reduce((sum, row) => sum + Number(row.quantity) * Number(row.price), 0);
}

export async function reservedSellQuantity(tx: Tx, userId: string, symbol: string): Promise<number> {
  const rows = await tx.select({ quantity: orders.quantity })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.symbol, symbol), eq(orders.side, "sell"), eq(orders.status, "open")));
  return rows.reduce((sum, row) => sum + Number(row.quantity), 0);
}

// --- Single-order / single-position evaluation (used immediately after
// placement, and by the sweeps below) -------------------------------------

export async function evaluateOneOrder(orderId: string, currentPrice: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order || order.status !== "open") return false;
    const type = order.type as PendingOrderType;
    const side = order.side as "buy" | "sell";
    const shouldFill = spotOrderShouldFill(type, side, Number(order.triggerPrice), currentPrice);
    if (!shouldFill) return false;
    const fillPrice = spotOrderFillPrice(type, side, Number(order.triggerPrice), currentPrice);
    try {
      await executeSpotFill(tx, order.userId, order.symbol, side, Number(order.quantity), fillPrice, order.id);
    } catch {
      // Insufficient funds/holding at fill time (e.g. the user spent the
      // reserved cash/asset some other way) - cancel instead of silently
      // dropping it so it doesn't sit open forever pretending to be valid.
      await tx.update(orders).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(orders.id, order.id));
      return false;
    }
    await tx.update(orders).set({ status: "filled", filledPrice: fillPrice.toFixed(8), filledAt: new Date() }).where(eq(orders.id, order.id));
    return true;
  });
}

export async function evaluateOnePosition(positionId: string, currentPrice: number): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [position] = await tx.select().from(positions).where(eq(positions.id, positionId)).for("update");
    if (!position || position.status !== "open") return false;
    const event = positionCloseEvent(
      position.side as "long" | "short",
      Number(position.liquidationPrice),
      position.takeProfitPrice == null ? null : Number(position.takeProfitPrice),
      position.stopLossPrice == null ? null : Number(position.stopLossPrice),
      currentPrice,
    );
    if (!event) return false;
    const pnl = event.reason === "liquidation"
      ? -Number(position.margin)
      : realizedPnl(Number(position.margin), closePnl(position, event.price));
    const credit = Math.round((Number(position.margin) + pnl) * 100) / 100;
    await tx.update(users).set({ cashBalance: sql`${users.cashBalance} + ${credit}` }).where(eq(users.id, position.userId));
    await tx.update(positions).set({
      status: event.reason === "liquidation" ? "liquidated" : "closed",
      closePrice: event.price.toFixed(8),
      closeReason: event.reason,
      realizedPnl: pnl.toFixed(2),
      closedAt: new Date(),
    }).where(eq(positions.id, position.id));
    await tx.insert(transactions).values({
      userId: position.userId,
      type: event.reason === "liquidation" ? "position_liquidated" : "position_closed",
      amount: pnl.toFixed(2),
      description: `${event.reason === "liquidation" ? "Liquidated" : event.reason === "take_profit" ? "Take-profit closed" : "Stop-loss closed"} ${Number(position.leverage)}x ${position.side} ${position.symbol} position at $${event.price}`,
    });
    return true;
  });
}

function closePnl(position: typeof positions.$inferSelect, closePrice: number): number {
  const entry = Number(position.entryPrice);
  const qty = Number(position.quantity);
  return position.side === "long" ? (closePrice - entry) * qty : (entry - closePrice) * qty;
}

// --- Sweeps: evaluate every open order/position (optionally scoped to one
// user) against a map of live prices. ---------------------------------------

export async function sweepOrders(prices: Record<string, number>, userId?: string): Promise<number> {
  const symbols = Object.keys(prices);
  if (symbols.length === 0) return 0;
  const where = userId
    ? and(eq(orders.status, "open"), eq(orders.userId, userId), inArray(orders.symbol, symbols))
    : and(eq(orders.status, "open"), inArray(orders.symbol, symbols));
  const open = await db.select({ id: orders.id, symbol: orders.symbol, type: orders.type, side: orders.side, triggerPrice: orders.triggerPrice }).from(orders).where(where);
  let filled = 0;
  for (const order of open) {
    const price = prices[order.symbol];
    if (price == null || price <= 0) continue;
    if (!spotOrderShouldFill(order.type as PendingOrderType, order.side as "buy" | "sell", Number(order.triggerPrice), price)) continue;
    if (await evaluateOneOrder(order.id, price)) filled++;
  }
  return filled;
}

export async function sweepPositions(prices: Record<string, number>, userId?: string): Promise<number> {
  const symbols = Object.keys(prices);
  if (symbols.length === 0) return 0;
  const where = userId
    ? and(eq(positions.status, "open"), eq(positions.userId, userId), inArray(positions.symbol, symbols))
    : and(eq(positions.status, "open"), inArray(positions.symbol, symbols));
  const open = await db.select({
    id: positions.id, symbol: positions.symbol, side: positions.side,
    liquidationPrice: positions.liquidationPrice, takeProfitPrice: positions.takeProfitPrice, stopLossPrice: positions.stopLossPrice,
  }).from(positions).where(where);
  let closed = 0;
  for (const position of open) {
    const price = prices[position.symbol];
    if (price == null || price <= 0) continue;
    const event = positionCloseEvent(
      position.side as "long" | "short",
      Number(position.liquidationPrice),
      position.takeProfitPrice == null ? null : Number(position.takeProfitPrice),
      position.stopLossPrice == null ? null : Number(position.stopLossPrice),
      price,
    );
    if (!event) continue;
    if (await evaluateOnePosition(position.id, price)) closed++;
  }
  return closed;
}

// Global sweep cooldown, per server instance. Best-effort only: with
// multiple serverless instances each has its own timer, but combined with
// the per-user sweep on every /api/app load this keeps fills timely without
// scanning the whole orders/positions table on every single page view.
let lastGlobalSweep = 0;
const GLOBAL_SWEEP_COOLDOWN_MS = 20_000;

export async function maybeSweepAll(prices: Record<string, number>) {
  const now = Date.now();
  if (now - lastGlobalSweep < GLOBAL_SWEEP_COOLDOWN_MS) return;
  lastGlobalSweep = now;
  try {
    await Promise.all([sweepOrders(prices), sweepPositions(prices)]);
  } catch (error) {
    console.error("Trading engine sweep failed:", error);
  }
}

export async function sweepForUser(prices: Record<string, number>, userId: string) {
  try {
    await Promise.all([sweepOrders(prices, userId), sweepPositions(prices, userId)]);
  } catch (error) {
    console.error("Trading engine per-user sweep failed:", error);
  }
}
