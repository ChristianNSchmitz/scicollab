import { createAdminClient } from "@/lib/supabase/admin";
import { sendDigests } from "@/lib/social/digest";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Weekly notification digest. Vercel Cron calls this on Monday mornings
 * (vercel.json) with `Authorization: Bearer $CRON_SECRET`; without the secret
 * set the route refuses everything. `?dry=1` counts who would get one and
 * sends nothing. Needs BREVO_API_KEY and CONTACT_FROM_EMAIL to send.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const url = new URL(req.url);
  const origin = process.env.SCICOLLAB_SITE_URL || url.origin;
  const result = await sendDigests(createAdminClient(), origin, { dry: url.searchParams.get("dry") === "1", limit: 2000 });
  return Response.json(result);
}
