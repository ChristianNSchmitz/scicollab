import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, Tag, Visibility, btn, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { after } from "next/server";
import { bibliometricsFor, loadSnapshots, type Bibliometrics } from "@/lib/record/bibliometrics";
import { isDue, syncResearcher, DEMO_ORCID, normaliseOrcid, SYNC_INTERVAL_MS } from "@/lib/openalex/sync";
import { readAuthor, readPublications, lastRuns, type PubRow, type RunRow } from "@/lib/openalex/store";
import { examplePublications, exampleRun } from "@/lib/openalex/example";
import { syncNow } from "@/app/actions/openalex";
import { isConfigured } from "@/lib/mode";
import { loadRecord } from "@/lib/record/metrics";
import { buildTimeline, RANGES, type Range, type Timeline } from "@/lib/record/timeline";
import TimelineChart from "@/components/record/TimelineChart";
import { ensureRecordSeed } from "@/lib/record/demo-seed";

export const dynamic = "force-dynamic";

/** Your record — board B3 screen 16. Six axes, never summed. Citations,
 *  h-index and recommendations sit above them as three separate numbers,
 *  each with its source; nothing on this page combines them. */
export default async function You({ searchParams }: { searchParams: Promise<{ range?: string; sync?: string }> }) {
  ensureRecordSeed();
  const { range: rangeParam, sync: syncFlash } = await searchParams;
  const range: Range = RANGES.some((r) => r.key === rangeParam) ? (rangeParam as Range) : "months";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: profile }, { data: cards }, { count: questions }, { count: answers }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
    supabase.from("method_cards").select("id, code, title, outcome, visibility, reproductions, created_at").eq("author_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("questions").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
    supabase.from("answers").select("id", { count: "exact", head: true }).eq("author_id", user!.id),
  ]);

  // OpenAlex: synced every 12 hours by the scheduler. A visit is a safety
  // net — the first ever sync runs before the page renders (so there is
  // something to show), later overdue ones run after the response is sent.
  if (await isDue(user!.id, profile?.orcid)) {
    const synced = await readAuthor(user!.id);
    if (!synced || synced.orcid !== normaliseOrcid(profile?.orcid)) {
      await Promise.race([syncResearcher(user!.id, profile?.orcid, "visit"), new Promise((r) => setTimeout(r, 12000))]);
    } else {
      after(() => syncResearcher(user!.id, profile?.orcid, "visit"));
    }
  }
  const isExample = !isConfigured() && normaliseOrcid(profile?.orcid) === DEMO_ORCID;
  const [pubs, runs] = isExample
    ? [examplePublications(user!.id), [exampleRun(user!.id)]]
    : await Promise.all([readPublications(user!.id), lastRuns(user!.id, 5)]);

  // Recommendations: other people endorsing your method cards.
  const cardIds = (cards ?? []).map((c) => c.id);
  const [{ data: recs }, biblio] = await Promise.all([
    cardIds.length
      ? supabase.from("recommendations").select("card_id, created_at").in("card_id", cardIds).neq("user_id", user!.id)
      : Promise.resolve({ data: [] as any[] }),
    bibliometricsFor(user!.id, profile?.orcid),
  ]);
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
      <Publications pubs={pubs} runs={runs} biblio={biblio} example={isExample} flash={syncFlash} />

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
    biblio.state === "pending" ? <>Fetching your record from OpenAlex for the first time…</> :
    biblio.state === "unreachable" ? <>{biblio.message ?? "OpenAlex could not be reached."} The next sync will try again.</> : null;

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

/** Publications as last synced from OpenAlex, what changed, and when. */
function Publications({ pubs, runs, biblio, example, flash }: {
  pubs: PubRow[]; runs: RunRow[]; biblio: Bibliometrics; example: boolean; flash?: string;
}) {
  if (biblio.state === "no-orcid" || biblio.state === "invalid-orcid") return null;
  const sorted = [...pubs].sort((a, b) => (b.pub_date ?? `${b.year ?? 0}`).localeCompare(a.pub_date ?? `${a.year ?? 0}`));
  const last = runs.find((r) => r.status === "ok");
  const lastAny = runs[0];
  const synced = biblio.state === "ok" ? biblio.updated : last?.finished_at ?? null;
  const nextIn = synced ? Math.max(0, +new Date(synced) + SYNC_INTERVAL_MS - Date.now()) : 0;
  const hours = (ms: number) => (ms < 3600e3 ? `${Math.max(1, Math.round(ms / 60e3))} min` : `${Math.round(ms / 3600e3)} h`);
  const isNew = (p: PubRow) => !example ? last && !last.initial && last.changes.some((c) => c.new && c.openalex_id === p.openalex_id) : p.openalex_id === "W-example-0";
  const flashText: Record<string, string> = {
    ok: "Synced just now.", cooldown: "Synced less than 10 minutes ago; try again shortly.",
    "rate-limited": "OpenAlex's daily allowance is used up; the next scheduled sync will retry.",
    "not-found": "OpenAlex has no record for this ORCID.", error: "OpenAlex could not be reached; the next sync will retry.",
    skipped: "Nothing to sync for this account.",
  };
  const link = (p: PubRow) => (p.doi ? `https://doi.org/${p.doi}` : p.openalex_id.startsWith("W-example") ? undefined : `https://openalex.org/${p.openalex_id}`);
  const row = (p: PubRow) => {
    const d = p.cited_by_count - p.prev_cited_by_count;
    const href = link(p);
    return (
      <div key={p.openalex_id} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "10px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 320px", minWidth: 0 }}>
          <div style={{ font: "500 12.5px/1.45 var(--sans)" }}>
            {isNew(p) && <span style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: "var(--ok)", border: "1px solid var(--ok)", padding: "1px 5px", marginRight: 7 }}>NEW</span>}
            {href ? <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--ink)" }}>{p.title || "Untitled"}</a> : (p.title || "Untitled")}
          </div>
          <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 3 }}>
            {[p.venue, p.year, p.type].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
          <span style={{ font: mono(13, 600) }}>{p.cited_by_count}</span>
          <span style={{ font: mono(10.5), color: "var(--mute)" }}> citations</span>
          {d !== 0 && <div style={{ font: mono(10.5), color: d > 0 ? "var(--ok)" : "var(--mute)" }}>{d > 0 ? "+" : ""}{d} since last sync</div>}
        </div>
      </div>
    );
  };

  return (
    <Panel style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: "8px 14px", borderBottom: "1px solid var(--rule)" }}>
        <span style={{ font: mono(10, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", flex: 1 }}>
          Publications · {pubs.length} from OpenAlex{example ? " · example" : ""}
        </span>
        <span style={{ font: mono(10.5), color: "var(--mute)" }}>
          {example ? "demo account, not synced" : synced ? `synced ${timeAgo(synced)} · next in ~${hours(nextIn)}` : "first sync pending"}
        </span>
        {!example && (
          <form action={syncNow}><button type="submit" style={{ ...btn, height: 28, padding: "0 10px", font: mono(11, 500) }}>Sync now</button></form>
        )}
      </div>

      {flash && flashText[flash] && (
        <div role="status" style={{ padding: "8px 14px", borderBottom: "1px solid var(--rule)", font: "400 12px/1.5 var(--sans)", background: "var(--bg)" }}>{flashText[flash]}</div>
      )}

      {last && !last.initial && (last.new_works > 0 || last.citations_delta !== 0 || last.removed_works > 0) && (
        <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: "400 12px/1.6 var(--sans)" }}>
          <b style={{ font: mono(10, 700), letterSpacing: ".08em" }}>SINCE THE PREVIOUS SYNC</b>{"  "}
          {[
            last.citations_delta ? `${last.citations_delta > 0 ? "+" : ""}${last.citations_delta} citations` : null,
            last.new_works ? `${last.new_works} new publication${last.new_works > 1 ? "s" : ""}` : null,
            last.removed_works ? `${last.removed_works} no longer attributed to you by OpenAlex` : null,
          ].filter(Boolean).join(" · ")}
        </div>
      )}

      {lastAny && lastAny.status !== "ok" && lastAny.status !== "running" && !example && (
        <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--rule)", font: "400 11.5px/1.5 var(--sans)", color: "var(--mute)" }}>
          Last attempt {timeAgo(lastAny.started_at)}: {lastAny.error ?? lastAny.status}
        </div>
      )}

      {pubs.length === 0 ? (
        <Empty>{biblio.state === "pending" ? "The first sync is still running. Reload in a moment." : "No publications in OpenAlex for this ORCID yet."}</Empty>
      ) : (
        <>
          {sorted.slice(0, 8).map(row)}
          {sorted.length > 8 && (
            <details>
              <summary style={{ padding: "10px 14px", font: mono(11), color: "var(--link)", cursor: "pointer" }}>Show all {sorted.length}</summary>
              {sorted.slice(8).map(row)}
            </details>
          )}
        </>
      )}
      <div style={{ padding: "9px 14px", font: "400 11px/1.6 var(--sans)", color: "var(--mute)" }}>
        Synced from <a href="https://openalex.org" target="_blank" rel="noreferrer" style={{ color: "var(--link)" }}>OpenAlex</a> by your ORCID every 12 hours. If a paper is missing or wrongly attributed, it needs fixing in OpenAlex or ORCID; it will follow here on the next sync.
      </div>
    </Panel>
  );
}
