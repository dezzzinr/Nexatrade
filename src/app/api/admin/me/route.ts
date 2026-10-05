import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Lightweight identity check for the admin panel. Deliberately does not
// fall back to creating a demo user the way /api/app does, so visiting
// /admin while signed out or as a regular user never silently provisions
// an account.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  return NextResponse.json({ user: { id: admin.id, name: admin.name, email: admin.email } });
}
