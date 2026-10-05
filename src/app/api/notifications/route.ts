import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
const bad = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

// The current user's notifications (most recent first), plus an unread count.
export async function GET(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    const [rows, unread] = await Promise.all([
      db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt)).limit(100),
      db.select({ count: sql<number>`count(*)::int` }).from(notifications).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt))),
    ]);
    return NextResponse.json({ notifications: rows, unread: unread[0]?.count ?? 0 });
  } catch (error) {
    console.error("Notifications GET:", error);
    return bad("Unable to load your notifications.", 500);
  }
}

// Mark all of the current user's notifications as read.
export async function POST(request: NextRequest) {
  try {
    const user = await getUser(request);
    if (!user) return bad("Session expired. Please refresh the page.", 401);
    await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, user.id), isNull(notifications.readAt)));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notifications POST:", error);
    return bad("Unable to update your notifications.", 500);
  }
}
