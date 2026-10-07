import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, transactions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";
import { notifyUser } from "@/lib/notify";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// Directly set a user's cash balance. The delta is logged as an
// admin_credit/admin_debit transaction (visible in the user's transaction
// history) so there's always an audit trail of manual balance edits.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const newBalance = Number(body.newBalance);
    const note = body.note ? String(body.note).trim().slice(0, 300) : "";
    if (!Number.isFinite(newBalance) || newBalance < 0 || newBalance > 100000000) return bad("Enter a valid balance.");

    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx.select().from(users).where(eq(users.id, id)).for("update");
      if (!wallet) throw new Error("User not found.");
      const oldBalance = Number(wallet.cashBalance);
      const delta = Math.round((newBalance - oldBalance) * 100) / 100;
      await tx.update(users).set({ cashBalance: newBalance.toFixed(2) }).where(eq(users.id, id));
      if (Math.abs(delta) >= 0.01) {
        await tx.insert(transactions).values({
          userId: id,
          type: delta > 0 ? "admin_credit" : "admin_debit",
          amount: Math.abs(delta).toFixed(2),
          description: note || `Balance ${delta > 0 ? "increased" : "decreased"} by admin`,
        });
      }
      return { message: `Balance updated to $${newBalance.toFixed(2)}.`, delta };
    });

    if (Math.abs(result.delta) >= 0.01) {
      await notifyUser({
        userId: id,
        type: result.delta > 0 ? "admin_credit" : "admin_debit",
        title: result.delta > 0 ? "Balance credited" : "Balance debited",
        message: `An admin ${result.delta > 0 ? "credited" : "debited"} $${Math.abs(result.delta).toFixed(2)} ${result.delta > 0 ? "to" : "from"} your account balance.${note ? ` Note: ${note}` : ""}`,
      });
    }

    return NextResponse.json({ success: true, message: result.message });
  } catch (error) {
    console.error("Admin balance edit:", error);
    return bad(error instanceof Error ? error.message : "Unable to update balance.", 400);
  }
}
