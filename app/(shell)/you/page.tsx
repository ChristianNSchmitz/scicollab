import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, Tag, Visibility, btn, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Your record — board B3 screen 16. Six axes, never summed: there is no
 *  single number anywhere on this page that stands for a researcher. */
export default async function You() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: cards }, { count: questions }, { count: answers }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    supabase.from("method_cards").select("id, code, title, outcome, visibility, reproductions, created_at").eq("author_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
    supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
  ]);

  const nulls = (cards ?? []).filter((c) => c.outcome === "negative").length;
  const reproductions = (cards ?? []).reduce((n, c) => n + (c.reproductions ?? 0), 0);

  const axes = [
    ["Methods recorded", cards?.length ?? 0],
    ["Null results recorded", nulls],
    ["Questions asked", questions ?? 0],
    ["Answers given", answers ?? 0],
    ["Reproductions of your work", reproductions],
    ["Data deposited", 0],
  ] as const;

  return (
    <Page
      title={profile?.display_name || "Your record"}
      lede={[profile?.role_title, profile?.institution, profile?.field].filter(Boolean).join(" · ") || "Add an institution and field in Settings."}
      actions={
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/you/record" style={btn}>Your record →</Link>
          <Link href="/settings" style={btn}>Edit profile</Link>
        </div>
      }
    >
      <Panel style={{ marginBottom: 16 }}>
        <PanelHead>Six axes · never summed</PanelHead>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)" }}>
          {axes.map(([label, value], i) => (
            <div key={label} style={{ padding: 16, borderRight: i % 3 === 2 ? undefined : "1px solid var(--rule)", borderTop: i > 2 ? "1px solid var(--rule)" : undefined }}>
              <div style={{ font: mono(26, 700), letterSpacing: "-.02em" }}>{value}</div>
              <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 5 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)", font: "400 11.5px/1.6 var(--sans)", color: "var(--mute)" }}>
          These are never added together, and no institution can obtain them per researcher — board K5 question 9.
        </div>
      </Panel>

      <h2 style={{ font: mono(11, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", margin: "0 0 8px" }}>Your method cards</h2>
      <Panel>
        {(cards?.length ?? 0) === 0 ? (
          <Empty>Nothing recorded yet. <Link href="/methods/new" style={{ color: "var(--link)" }}>Record the first</Link>.</Empty>
        ) : cards!.map((c) => (
          <Link key={c.id} href={`/methods/${c.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
            <Outcome value={c.outcome} />
            <span style={{ font: mono(11), color: "var(--mute)" }}>{c.code}</span>
            <span style={{ font: mono(13, 500), flex: 1, minWidth: 0 }}>{c.title}</span>
            <span style={{ font: mono(10.5), color: "var(--mute)" }}>{timeAgo(c.created_at)}</span>
            <Visibility value={c.visibility} />
          </Link>
        ))}
      </Panel>
    </Page>
  );
}
