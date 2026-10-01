import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, Tag, Visibility, btn, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { bibliometricsFor, saveSnapshot, loadSnapshots, type Bibliometrics } from "@/lib/record/bibliometrics";
import { loadRecord } from "@/lib/record/metrics";
import { buildTimeline, RANGES, type Range, type Timeline } from "@/lib/record/timeline";
import TimelineChart from "@/components/record/TimelineChart";
import { ensureRecordSeed } from "@/lib/record/demo-seed";

export const dynamic = "force-dynamic";

/** Your record — board B3 screen 16. Six axes, never summed. Citations,
 *  h-index and recommendations sit above them as three separate numbers,
 *  each with its source; nothing on this page combines them. */
export default async function You({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  ensureRecordSeed();
  const { range: rangeParam } = await searchParams;
  const range: Range = RANGES.some((r) => r.key === rangeParam) ? (rangeParam as Range) : "months";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: cards }, { count: questions }, { count: answers }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    supabase.from("method_cards").select("id, code, title, outcome, visibility, reproductions, created_at").eq("author_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
    supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
  ]);

  // Recommendations: other people endorsing your method cards.
  const cardIds = (cards ?? []).map((c) => c.id);
  const [{ data: recs }, biblio] = await Promise.all([
    cardIds.length
      ? supabase.from("recommendations").select("card_id, created_at").in("card_id", cardIds).neq("user_id", user!.id)
      : Promise.resolve({ data: [] as any[] }),
    bibliometricsFor(profile?.orcid),
  ]);
  // One snapshot a day builds the weekly and monthly citation history.
  await saveSnapshot(supabase, user!.id, biblio);
  const [snapshots, record] = await Promise.all([
    loadSnapshots(supabase, user!.id, biblio),
    loadRecord(supabase, user!.id, 12),
  ]);
  const timeline = buildTimeline(range, record.events, biblio, snapshots);

  const recent = (recs ?? []).filter((r) => Date.now() - +new Date(r.created_at) < 28 * 864e5).length;
  const recCards = new Set((recs ?? []).map((r) => r.card_id)).size;

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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href="/you/record" style={btn}>Your record →</Link>
          <Link href="/settings" style={btn}>Edit profile</Link>
        </div>
      }
    >
      <Headline biblio={biblio} recs={recs?.length ?? 0} recent={recent} recCards={recCards} />
      <OverTime timeline={timeline} />

      <Panel style={{ marginBottom: 16 }}>
        <PanelHead>Six axes · never summed</PanelHead>
        {/* dividers come from the 1px gap, so any column count draws them right */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 1, background: "var(--rule)" }}>
          {axes.map(([label, value]) => (
            <div key={label} style={{ padding: 16, background: "var(--surface)" }}>
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
          <Link key={c.id} href={`/methods/${c.id}`} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
            <Outcome value={c.outcome} />
            <span style={{ font: mono(11), color: "var(--mute)" }}>{c.code}</span>
            <span style={{ font: mono(13, 500), flex: "1 1 220px", minWidth: 0 }}>{c.title}</span>
            <span style={{ font: mono(10.5), color: "var(--mute)" }}>{timeAgo(c.created_at)}</span>
            <Visibility value={c.visibility} />
          </Link>
        ))}
      </Panel>
    </Page>
  );
}

/** Three numbers, three sources, never combined. */
function Headline({ biblio, recs, recent, recCards }: {
  biblio: Bibliometrics; recs: number; recent: number; recCards: number;
}) {
  const ok = biblio.state === "ok" ? biblio : null;
  const missing =
    biblio.state === "no-orcid" ? <>Add your ORCID in <Link href="/settings" style={{ color: "var(--link)" }}>Settings</Link> to show these.</> :
    biblio.state === "invalid-orcid" ? <>“{biblio.orcid}” is not an ORCID iD. <Link href="/settings" style={{ color: "var(--link)" }}>Fix it in Settings</Link>.</> :
    biblio.state === "not-found" ? <>OpenAlex has no author for ORCID {biblio.orcid} yet.</> :
    biblio.state === "unreachable" ? <>OpenAlex could not be reached. Try again later.</> : null;

  const cells: { value: string | number; label: string; sub: React.ReactNode }[] = [
    { value: ok ? ok.citations.toLocaleString("en-GB") : "—", label: "Citations",
      sub: ok ? `+${ok.citationsThisYear} in ${ok.year} · ${ok.works} works` : missing },
    { value: ok ? ok.hIndex : "—", label: "h-index",
      sub: ok ? `${ok.hIndex} works cited at least ${ok.hIndex} times` : missing },
    { value: recs, label: "Recommendations",
      sub: recs ? `+${recent} in 4 weeks · on ${recCards} of your cards` : <>None yet. Others can recommend your shared cards.</> },
  ];

  return (
    <Panel style={{ marginBottom: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))" }}>
        {cells.map((c, i) => (
          <div key={c.label} style={{ padding: "16px 16px 14px", borderLeft: i ? "1px solid var(--rule)" : undefined }}>
            <div style={{ font: mono(34, 700), letterSpacing: "-.03em" }}>{c.value}</div>
            <div style={{ font: mono(11, 500), marginTop: 6 }}>{c.label}</div>
            <div style={{ font: "400 11.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 4 }}>{c.sub}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "9px 16px", borderTop: "1px solid var(--rule)", font: "400 11px/1.6 var(--sans)", color: "var(--mute)" }}>
        {ok ? (
          <>
            Citations and h-index from <a href={ok.url} target="_blank" rel="noreferrer" style={{ color: "var(--link)" }}>OpenAlex</a>
            {ok.example ? " · example values for the demo account" : ok.updated ? `, updated ${ok.updated.slice(0, 10)}` : ""}.{" "}
          </>
        ) : null}
        Recommendations are counted on SciCollab, from people other than you. The three numbers are shown separately and never combined.
      </div>
    </Panel>
  );
}

/** Citations and your involvement, as running totals over the chosen range. */
function OverTime({ timeline: t }: { timeline: Timeline }) {
  const delta = (v: (number | null)[]) => {
    const xs = v.filter((x): x is number => x !== null);
    return xs.length > 1 ? xs[xs.length - 1] - xs[0] : null;
  };
  const dc = delta(t.citations), di = delta(t.involvement);
  return (
    <Panel style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--rule)" }}>
        <span style={{ font: mono(10, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", flex: 1 }}>
          Over time · running totals
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", border: "1px solid var(--rule)" }} role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <Link key={r.key} href={r.key === "months" ? "/you" : `/you?range=${r.key}`} scroll={false}
                  aria-current={r.key === t.range ? "true" : undefined}
                  style={{ padding: "5px 10px", font: mono(11, 500), textDecoration: "none",
                           background: r.key === t.range ? "var(--ink)" : "transparent",
                           color: r.key === t.range ? "var(--bg)" : "var(--ink)" }}>
              {r.label}
            </Link>
          ))}
        </div>
      </div>
      <div style={{ padding: "12px 14px 10px" }}>
        <TimelineChart
          labels={t.labels} tips={t.tips}
          rows={[
            { title: "Citations", unit: "citations", values: t.citations },
            { title: "Involvement", unit: "contributions", values: t.involvement },
          ]}
        />
      </div>
      <div style={{ padding: "9px 14px", borderTop: "1px solid var(--rule)", font: "400 11px/1.6 var(--sans)", color: "var(--mute)" }}>
        {dc !== null && <>Citations +{dc.toLocaleString("en-GB")} and involvement +{di} over this range. </>}
        {t.citationsNote} Involvement counts everything you contributed: cards, null results, repeats, questions, answers, reviews and mentoring; what others did with your work is in <Link href="/you/record" style={{ color: "var(--link)" }}>Your record</Link>. Each line has its own scale.
      </div>
    </Panel>
  );
}
