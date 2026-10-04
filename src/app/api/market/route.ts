import { NextResponse } from "next/server";
import { getMarketSnapshot } from "@/lib/market-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getMarketSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      "Cache-Control": snapshot.status === "live"
        ? "public, s-maxage=45, stale-while-revalidate=15"
        : "no-store",
    },
  });
}
