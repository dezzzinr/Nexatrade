import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkPassword, clearSession, hashPassword, isAdminEmail, setSession } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = String(body.action ?? "");
    if (action === "logout") return await clearSession(request, NextResponse.json({ success: true }));
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !password) return NextResponse.json({ error: "Enter a valid email and password." }, { status: 400 });
    if (action === "register") {
      const name = String(body.name ?? "").trim();
      if (name.length < 2 || name.length > 80) return NextResponse.json({ error: "Name must be between 2 and 80 characters." }, { status: 400 });
      if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
      const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
      if (existing) return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
      const [user] = await db.insert(users).values({ name, email, passwordHash: hashPassword(password), cashBalance: "10000.00", role: isAdminEmail(email) ? "admin" : "user" }).returning();
      return await setSession(NextResponse.json({ success: true }), user.id);
    }
    if (action === "login") {
      const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
      if (!user?.passwordHash || !checkPassword(password, user.passwordHash)) return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
      if (user.accountStatus === "locked") return NextResponse.json({ error: "This account has been locked. Contact support for help." }, { status: 403 });
      // Allow promoting an existing account to admin by listing its email in ADMIN_EMAILS.
      if (isAdminEmail(email) && user.role !== "admin") await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      return await setSession(NextResponse.json({ success: true }), user.id);
    }
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  } catch (error) {
    console.error("Auth:", error);
    return NextResponse.json({ error: "Unable to process your request." }, { status: 500 });
  }
}
