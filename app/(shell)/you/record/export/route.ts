import { createClient } from "@/lib/supabase/server";
import { loadRecord, AXES, AXIS_LABEL, type Axis } from "@/lib/record/metrics";
import { ensureRecordSeed } from "@/lib/record/demo-seed";

export const dynamic = "force-dynamic";

/** The ledger as CSV — every row the record counts, with its source. */
export async function GET(req: Request) {
  ensureRecordSeed();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first.", { status: 401 });

  const axis = new URL(req.url).searchParams.get("axis");
  const r = await loadRecord(supabase, user.id, 12);
  const rows = AXES.some((a) => a.key === axis) ? r.events.filter((e) => e.axis === (axis as Axis)) : r.events;

  const cell = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const origin = new URL(req.url).origin;
  const csv = [
    "when,axis,what,by_someone_else,source",
    ...rows.map((e) => [e.at, AXIS_LABEL[e.axis], e.text, e.reuse ? "yes" : "no", origin + e.href].map(cell).join(",")),
  ].join("\n");

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="scicollab-record${axis ? "-" + axis : ""}.csv"`,
    },
  });
}
