import { NextResponse } from "next/server";
import { loadShowcase } from "@/lib/showcase";

/**
 * The front page's "most active right now" list, for its once-a-minute
 * refresh. Public on purpose: it only ever returns what lib/showcase.ts lets
 * through (items tagged public, as short read-only summaries). GET only —
 * there is nothing here that can be changed.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const items = await loadShowcase();
  return NextResponse.json(
    { items, at: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=30, s-maxage=30", "X-Content-Type-Options": "nosniff" } },
  );
}
