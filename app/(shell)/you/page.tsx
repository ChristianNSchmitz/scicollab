import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { activityOf, activityOnMine, type Activity } from "@/lib/social/activity";
import { peopleById } from "@/lib/people";
import { Panel, PanelHead } from "@/components/ui";
import ActivityList from "@/components/social/ActivityList";
import YouShell from "@/components/you/YouShell";

export const dynamic = "force-dynamic";

const MONTH = 30 * 864e5;

/** You, Activity: three numbers that matter and one list of what happened, newest first.
 *  The full record (every axis) and the publications have their own tabs. */
export default async function You() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const [{ data: cards }, onMine, mine, { data: helped }] = await Promise.all([
    supabase.from("method_cards").select("id, outcome").eq("author_id", me),
    activityOnMine(supabase, me, 365),
    activityOf(supabase, [me], { viewer: me, limit: 12, days: 60 }),
    supabase.from("post_replies").select("post_id, anchor, helped_at").eq("author_id", me).gte("helped_at", "1970-01-01"),
  ]);
  const { data: helpedPosts } = (helped ?? []).length
    ? await supabase.from("posts").select("id, title, author_id").in("id", (helped ?? []).map((h: any) => h.post_id))
    : { data: [] as any[] };
  const askers = await peopleById(supabase, (helpedPosts ?? []).map((p: any) => p.author_id));
  const helpedItems: Activity[] = (helped ?? []).map((h: any) => {
    const post = (helpedPosts ?? []).find((p: any) => p.id === h.post_id);
    return { at: h.helped_at, actor: askers.get(post?.author_id) ?? null, kind: "answer", text: `found your feedback${h.anchor ? ` on ${h.anchor}` : ""} helpful:`, title: post?.title ?? "a post", href: `/posts/${h.post_id}#replies` };
  });

  const nulls = (cards ?? []).filter((c: any) => c.outcome === "negative").length;
  const helpedMonth = (helped ?? []).filter((h: any) => Date.now() - +new Date(h.helped_at) < MONTH).length;
  const recent = [...helpedItems, ...onMine.filter((a) => Date.now() - +new Date(a.at) < 2 * MONTH), ...mine]
    .sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 12);
  const max = Math.max(1, cards?.length ?? 0, onMine.length, (helped ?? []).length);
  const tiles = [
    { k: "Methods recorded", n: cards?.length ?? 0, unit: nulls ? `${nulls} null result${nulls === 1 ? "" : "s"}` : "", href: "/methods" },
    { k: "Used by others", n: onMine.length, unit: "repeats and forks", href: "/you/record" },
    { k: "Feedback that helped", n: (helped ?? []).length, unit: helpedMonth ? `${helpedMonth} this month` : "", href: "/you/record" },
  ];

  return (
    <YouShell active="activity">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 12 }}>
        {tiles.map((t) => (
          <Link key={t.k} href={t.href} className="sc-hl-tile" style={{ display: "block", textDecoration: "none", color: "var(--ink)", padding: "12px 14px" }}>
            <span className="sc-hl-kicker">{t.k}</span>
            <span style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 8 }}>
              <span className="sc-hl-big">{t.n}</span><span className="sc-hl-unit">{t.unit}</span>
            </span>
            <span aria-hidden="true" style={{ display: "block", height: 6, borderRadius: 999, background: "var(--rule)", marginTop: 10, overflow: "hidden" }}>
              <span style={{ display: "block", height: "100%", width: `${Math.round((t.n / max) * 100)}%`, borderRadius: 999, background: "var(--ok)" }} />
            </span>
          </Link>
        ))}
      </div>
      <Panel>
        <PanelHead>Lately</PanelHead>
        <ActivityList items={recent} empty="Nothing yet. Post, answer or record a method, and it shows up here." />
        <Link href="/you/record" style={{ display: "block", padding: "10px 14px", font: "600 12.5px/1 var(--sans)", color: "var(--mute)", textDecoration: "none" }}>Full record →</Link>
      </Panel>
    </YouShell>
  );
}
