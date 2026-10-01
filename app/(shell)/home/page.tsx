import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, Tag, Visibility, btn, btnPrimary, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Home feed — board H1. Six object types share one skeleton; the two that
 *  carry live data today are method cards and questions. */
export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: cards }, { data: questions }, { count: myCards }] = await Promise.all([
    supabase
      .from("method_cards")
      .select("id, code, version, title, outcome, outcome_detail, fails_under, tags, visibility, system, reproductions, created_at, author_id, forked_from")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("questions")
      .select("id, title, body, tags, created_at, author_id")
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("method_cards")
      .select("id", { count: "exact", head: true })
      .eq("author_id", user!.id),
  ]);

  const authorIds = [...new Set([...(cards ?? []).map(c => c.author_id), ...(questions ?? []).map(q => q.author_id)])];
  const { data: people } = authorIds.length
    ? await supabase.from("profiles").select("id, display_name, institution").in("id", authorIds)
    : { data: [] as { id: string; display_name: string; institution: string }[] };
  const nameOf = (id: string) => people?.find(p => p.id === id)?.display_name || "Someone";
  const instOf = (id: string) => people?.find(p => p.id === id)?.institution || "";

  type Item =
    | { kind: "card"; at: string; c: NonNullable<typeof cards>[number] }
    | { kind: "question"; at: string; q: NonNullable<typeof questions>[number] };

  const feed: Item[] = [
    ...(cards ?? []).map((c) => ({ kind: "card" as const, at: c.created_at, c })),
    ...(questions ?? []).map((q) => ({ kind: "question" as const, at: q.created_at, q })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  return (
    <Page
      title="Home"
      lede="Ranked by recency for now. The controls that keep a feed honest — why am I seeing this, chronological, cross-field injection — are designed on board H1 and are not wired yet."
      actions={<Link href="/methods/new" style={btnPrimary}>Record a method</Link>}
    >
      <div className="sc-two-col">
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {feed.length === 0 && (
            <Panel>
              <Empty>
                Nothing here yet. The feed fills from real method cards and questions —{" "}
                <Link href="/methods/new" style={{ color: "var(--link)" }}>record the run that did not work</Link>.
              </Empty>
            </Panel>
          )}

          {feed.map((item) =>
            item.kind === "card" ? (
              <Panel key={`c-${item.c.id}`}>
                <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, borderBottom: "1px solid var(--rule)" }}>
                  <Outcome value={item.c.outcome} />
                  <span style={{ font: mono(11), color: "var(--mute)" }}>{item.c.code} · v{item.c.version}</span>
                  {item.c.forked_from && <Tag>fork</Tag>}
                  <span style={{ marginLeft: "auto", font: mono(11), color: "var(--mute)" }}>
                    {item.c.reproductions} reproductions · {timeAgo(item.c.created_at)}
                  </span>
                  <Visibility value={item.c.visibility} />
                </div>
                <div style={{ padding: "14px" }}>
                  <Link href={`/methods/${item.c.id}`} style={{ font: mono(15, 700, 1.35), color: "var(--ink)", textDecoration: "none" }}>
                    {item.c.title}
                  </Link>
                  <div style={{ font: mono(11), color: "var(--mute)", marginTop: 5 }}>
                    {nameOf(item.c.author_id)}{instOf(item.c.author_id) ? ` · ${instOf(item.c.author_id)}` : ""}
                    {item.c.system ? ` · ${item.c.system}` : ""}
                  </div>
                  {item.c.outcome_detail && (
                    <p style={{ font: "400 12.5px/1.65 var(--sans)", color: "var(--ink)", margin: "10px 0 0" }}>{item.c.outcome_detail}</p>
                  )}
                  {item.c.fails_under && (
                    <div style={{ marginTop: 10, borderLeft: "3px solid var(--signal)", background: "var(--bg)", padding: "9px 12px" }}>
                      <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal)", marginBottom: 4 }}>FAILS UNDER</div>
                      <p style={{ font: "400 12px/1.6 var(--sans)", margin: 0 }}>{item.c.fails_under}</p>
                    </div>
                  )}
                  {item.c.tags?.length > 0 && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 11 }}>
                      {item.c.tags.map((t: string) => <Tag key={t}>{t}</Tag>)}
                    </div>
                  )}
                </div>
              </Panel>
            ) : (
              <Panel key={`q-${item.q.id}`}>
                <div style={{ padding: "12px 14px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, borderBottom: "1px solid var(--rule)" }}>
                  <span style={{ font: mono(10, 700), letterSpacing: ".08em", color: "var(--info)", border: "1px solid var(--info)", padding: "3px 7px" }}>QUESTION</span>
                  <span style={{ marginLeft: "auto", font: mono(11), color: "var(--mute)" }}>{timeAgo(item.q.created_at)}</span>
                </div>
                <div style={{ padding: 14 }}>
                  <Link href={`/questions/${item.q.id}`} style={{ font: mono(15, 700, 1.35), color: "var(--ink)", textDecoration: "none" }}>
                    {item.q.title}
                  </Link>
                  <div style={{ font: mono(11), color: "var(--mute)", marginTop: 5 }}>{nameOf(item.q.author_id)}</div>
                  {item.q.body && <p style={{ font: "400 12.5px/1.65 var(--sans)", margin: "10px 0 0" }}>{item.q.body.slice(0, 260)}</p>}
                </div>
              </Panel>
            )
          )}
        </div>

        <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Panel>
            <PanelHead>Your record</PanelHead>
            <div style={{ padding: 14, font: mono(12, 400, 1.7) }}>
              <div><b style={{ font: mono(20, 700) }}>{myCards ?? 0}</b></div>
              <div style={{ color: "var(--mute)" }}>method cards recorded</div>
              <Link href="/methods" style={{ ...btn, marginTop: 12, width: "100%", justifyContent: "center" }}>Open your methods</Link>
            </div>
          </Panel>
          <Panel>
            <PanelHead>Ask with the data attached</PanelHead>
            <div style={{ padding: 14 }}>
              <p style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", margin: "0 0 12px" }}>
                A question carries the card that produced it, so peers see real conditions instead of a paraphrase.
              </p>
              <Link href="/ask" style={{ ...btn, width: "100%", justifyContent: "center" }}>Ask a question</Link>
            </div>
          </Panel>
        </aside>
      </div>
    </Page>
  );
}
