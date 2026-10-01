import { syncDue } from "@/lib/openalex/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Scheduled OpenAlex sync. Vercel Cron calls this every 12 hours (vercel.json)
 * with `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET set the route
 * refuses everything, so it can never be triggered by a stranger.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const { checked, results } = await syncDue(50);
  const summary = results.reduce<Record<string, number>>((m, r) => ((m[r.result.status] = (m[r.result.status] ?? 0) + 1), m), {});
  return Response.json({ checked, ...summary });
}
