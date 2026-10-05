import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, withdrawalRequests } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";
import { blockedActionMessage } from "@/lib/accounts";
import { WITHDRAWAL_METHOD_IDS } from "@/lib/withdrawals";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// A user's own withdrawal requests.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const rows = await db
      .select()
      .from(withdrawalRequests)
      .where(eq(withdrawalRequests.userId, user.id))
      .orderBy(desc(withdrawalRequests.createdAt))
      .limit(100);
    return NextResponse.json({ requests: rows });
  } catch (error) {
    console.error("Withdrawals GET:", error);
    return bad("Unable to load your withdrawal requests.", 500);
  }
}

// Submit a new withdrawal request. The requested amount is held immediately
// (deducted from the user's available cash balance) so it can't be spent or
// withdrawn twice while pending review. It is refunded if rejected, or
// ledgered as completed if approved - no automatic payout is ever sent.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const blocked = blockedActionMessage(user, "withdraw");
    if (blocked) return bad(blocked, 403);
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") return bad("Invalid request.");

    const method = String(body.method ?? "");
    if (!WITHDRAWAL_METHOD_IDS.includes(method as (typeof WITHDRAWAL_METHOD_IDS)[number])) return bad("Choose a valid payout method.");
    const methodLabel = method === "other" ? String(body.methodLabel ?? "").trim().slice(0, 60) : null;
    if (method === "other" && methodLabel !== null && methodLabel.length < 2) return bad("Tell us the name of the platform you'd like to be paid through.");

    const amount = Number(body.amount);
    const validAmount = Number.isFinite(amount) && amount > 0 && amount <= 10000000 && Math.abs(Math.round(amount * 100) - amount * 100) < 0.000001;
    if (!validAmount || amount < 1) return bad("Enter a valid amount of at least $1.");

    const destination = String(body.destination ?? "").trim().slice(0, 500);
    if (destination.length < 3) return bad("Tell us where to send your payout (wallet address, account details, email, etc.).");

    const note = body.note ? String(body.note).trim().slice(0, 1000) || null : null;

    const id = await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(users).where(eq(users.id, user.id)).for("update");
      if (Number(wallet.cashBalance) < amount) throw new Error("Insufficient available balance.");
      await tx.update(users).set({ cashBalance: sql`${users.cashBalance} - ${amount}` }).where(eq(users.id, user.id));
      const [row] = await tx
        .insert(withdrawalRequests)
        .values({ userId: user.id, method, methodLabel, amount: amount.toFixed(2), destination, note, status: "pending" })
        .returning({ id: withdrawalRequests.id });
      return row.id;
    });

    return NextResponse.json({ success: true, id, message: "Withdrawal request submitted for review. The amount has been reserved from your available balance." });
  } catch (error) {
    console.error("Withdrawals POST:", error);
    return bad(error instanceof Error ? error.message : "Unable to submit your withdrawal request. Please try again.", 400);
  }
}
