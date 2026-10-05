import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { botSubscriptions, copySubscriptions, planSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

const TABLES = { bot: botSubscriptions, copy: copySubscriptions, plan: planSubscriptions } as const;
type Kind = keyof typeof TABLES;

// Admin override to end a user's subscription (bot/copy/plan) early, e.g.
// as part of a refund or dispute. Sets expiresAt to now rather than
// deleting the row, so subscription history is preserved.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return bad("Admin access required.", 403);
    const { kind, id } = await params;
    if (!(kind in TABLES)) return bad("Invalid subscription type.");
    const body = await request.json().catch(() => ({}));
    if (body.action !== "cancel") return bad("Invalid action.");
    const table = TABLES[kind as Kind];
    const [row] = await db.update(table).set({ expiresAt: new Date() }).where(eq(table.id, id)).returning();
    if (!row) return bad("Subscription not found.", 404);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Admin cancel subscription:", error);
    return bad("Unable to cancel this subscription.", 500);
  }
}
