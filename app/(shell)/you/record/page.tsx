import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, Outcome, Visibility, btn, mono } from "@/components/ui";
import WeeklyBars from "@/components/record/WeeklyBars";
import { PrivacyStrip, Pair, tileGrid, smallCaps, WINDOWS } from "@/components/record/Chrome";
import { loadRecord, AXES, AXIS_LABEL, type Axis } from "@/lib/record/metrics";
import { ensureRecordSeed } from "@/lib/record/demo-seed";
import { cardReadStats } from "@/lib/record/reads";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Your record — boards B3·16 (personal dashboard) and B3·18 (change log),
 * wired. Private to you. Nine axes on nine scales, no score, no percentile.
 */
export default async function RecordPage({ searchParams }: {
  searchParams: Promise<{ weeks?: string; axis?: string }>;
}) {
  ensureRecordSeed();
  const sp = await searchParams;
  const weeks = WINDOWS.includes(Number(sp.weeks)) ? Number(sp.weeks) : 12;
  const axis = AXES.some((a) => a.key === sp.axis) ? (sp.axis as Axis) : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const r = await loadRecord(supabase, user.id, weeks);
  const weekStarts = r.weekStarts.map((d) => d.toISOString());
  const firstWeek = weekStarts[0].slice(0, 10);
  const ledger = axis ? r.events.filter((e) => e.axis === axis) : r.events;

  // Reads come only as aggregates, one call per shared card.
  const outputs = await Promise.all(r.outputs.map(async (o) => {
    const stats = await cardReadStats(supabase, o.id, user.id);
    const readers = (stats?.weekly ?? []).filter((w) => w.week >= firstWeek).reduce((n, w) => n + w.readers, 0);
    return { ...o, readers };
  }));

  const q = (p: Record<string, string | number | null>) => {
    const s = new URLSearchParams();
    const merged = { weeks, axis, ...p };
    if (merged.weeks !== 12) s.set("weeks", String(merged.weeks));
    if (merged.axis) s.set("axis", String(merged.axis));
    const str = s.toString();
    return `/you/record${str ? `?${str}` : ""}`;
  };

  return (
    <Page
      title="Your record"
      lede="Everything you have contributed and what others did with it, counted, never scored. Each axis has its own scale, and every number links to the rows that produced it."
      actions={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          <Link href={`/you/record/export${axis ? `?axis=${axis}` : ""}`} style={btn}>Export CSV</Link>
          <Link href="/you" style={btn}>Profile</Link>
        </div>
      }
    >
      <PrivacyStrip weeks={weeks} hrefFor={(w) => q({ weeks: w })}>
        This page is private. There is no single score, no percentile and no comparison with other researchers, and no institution can see it per person.
      </PrivacyStrip>

      {/* Nine axes, nine scales. */}
      <div style={tileGrid}>
        {r.axes.map((a) => {
          const signal = a.key === "nulls";
          return (
            <Panel key={a.key} style={signal ? { borderColor: "var(--signal)" } : undefined}>
              <div style={{ padding: "12px 14px 14px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <Link href={q({ axis: a.key }) + "#ledger"} style={{ ...smallCaps, color: signal ? "var(--signal)" : "var(--ink)", textDecoration: "none" }}>
                    {a.label}
                  </Link>
                  <span style={{ font: mono(26, 700), letterSpacing: "-.02em" }}>{a.total}</span>
                </div>
                <div style={{ font: mono(10.5), color: a.recent ? "var(--ok)" : "var(--mute)", textAlign: "right", margin: "2px 0 10px" }}>
                  {a.recent ? `+${a.recent}` : "none"} in {weeks} weeks
                </div>
                {a.key === "data" ? (
                  <div style={{ height: 71, display: "flex", alignItems: "center", justifyContent: "center", border: "1px dashed var(--rule)", font: mono(10.5), color: "var(--mute)" }}>
                    deposits are not wired yet
                  </div>
                ) : (
                  <WeeklyBars values={a.weekly} weekStarts={weekStarts} unit={a.unit} />
                )}
                <div style={{ marginTop: 10, paddingTop: 8, borderTop: "1px solid var(--rule)" }}>
                  {a.facts.map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", gap: 8, font: mono(10.5, 400, 1.8), color: "var(--mute)" }}>
                      <span>{k}</span><span style={{ color: "var(--ink)", textAlign: "right" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Per output, board J2: reads and documented reuse kept apart. */}
      <Panel style={{ marginBottom: 16 }}>
        <PanelHead>Your shared outputs · {weeks} weeks</PanelHead>
        {outputs.length === 0 ? (
          <Empty>
            Nothing shared yet. Cards you set to Lab or Public appear here with their reads and reuse.
          </Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr style={{ ...smallCaps, color: "var(--mute)", textAlign: "left" }}>
                  <th style={th}>Card</th>
                  <th style={{ ...th, textAlign: "right" }} title="Distinct readers per week, summed. Who they were is not stored.">Reads</th>
                  <th style={{ ...th, textAlign: "right" }}>Forks</th>
                  <th style={{ ...th, textAlign: "right" }}>Carried in questions</th>
                  <th style={{ ...th, textAlign: "right" }}>Repeats held / failed</th>
                  <th style={{ ...th, textAlign: "right" }}>Reviews</th>
                  <th style={th}></th>
                </tr>
              </thead>
              <tbody>
                {outputs.map((o) => (
                  <tr key={o.id} style={{ borderTop: "1px solid var(--rule)" }}>
                    <td style={td}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <Outcome value={o.outcome as any} />
                        <Link href={`/methods/${o.id}`} style={{ font: mono(12, 500), color: "var(--ink)" }}>{o.code} {o.title}</Link>
                      </div>
                    </td>
                    <td style={num}>{o.readers}</td>
                    <td style={num}>{o.forks}</td>
                    <td style={num}>{o.carried}</td>
                    <td style={num}>{o.held} / {o.failed}</td>
                    <td style={num}>{o.reviews}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <Link href={`/you/record/cards/${o.id}${weeks !== 12 ? `?weeks=${weeks}` : ""}`} style={{ font: mono(11) }}>analytics →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: "9px 14px", borderTop: "1px solid var(--rule)", font: "400 11px/1.6 var(--sans)", color: "var(--mute)" }}>
          A read is a distinct reader in one week. Who read your work is never stored, so it cannot be shown to you or anyone else (board J2).
        </div>
      </Panel>

      <Pair
        wide={
          <Panel>
            <PanelHead>Where your work went · reuse, not reads</PanelHead>
            {r.reuse.length === 0 ? (
              <Empty>
                {r.axes[0].total + r.axes[1].total === 0
                  ? <>Reuse starts with a card. <Link href="/methods/new" style={{ color: "var(--link)" }}>Record a method</Link>, including one that did not work.</>
                  : "Nobody has forked, reproduced or cited your cards yet."}
                {r.privateCards > 0 && <> {r.privateCards} of your cards are private, and others can only reuse what they can see.</>}
              </Empty>
            ) : r.reuse.slice(0, 8).map((e, i) => (
              <Link key={i} href={e.href} style={{ display: "flex", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" }}>
                <span style={{ font: "400 12.5px/1.5 var(--sans)", flex: 1, minWidth: 0 }}>{e.text}</span>
                <span style={{ font: mono(10.5), color: "var(--mute)", whiteSpace: "nowrap" }}>{timeAgo(e.at)}</span>
              </Link>
            ))}
          </Panel>
        }
        narrow={
          <Panel>
            <PanelHead>Open loops</PanelHead>
            {r.loops.length === 0 ? (
              <Empty>Nothing waiting on you.</Empty>
            ) : r.loops.slice(0, 7).map((l, i) => (
              <Link key={i} href={l.href} style={{ display: "block", padding: "10px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" }}>
                <div style={{ font: "400 12px/1.45 var(--sans)" }}>{l.text}</div>
                <div style={{ font: mono(10), color: "var(--mute)", marginTop: 3 }}>{l.hint}</div>
              </Link>
            ))}
          </Panel>
        }
      />

      <div id="ledger" />
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "8px 14px", borderBottom: "1px solid var(--rule)" }}>
          <span style={{ ...smallCaps, color: "var(--mute)", marginRight: 6 }}>Ledger · every count, row by row</span>
          {[{ key: null as Axis | null, label: `All · ${r.events.length}` }, ...AXES.map((a) => ({ key: a.key as Axis | null, label: `${a.label} · ${r.events.filter((e) => e.axis === a.key).length}` }))].map((f) => {
            const on = f.key === axis;
            return (
              <Link key={f.label} href={q({ axis: f.key }) + "#ledger"}
                    style={{ font: mono(10.5), padding: "4px 8px", textDecoration: "none",
                             border: `1px solid ${on ? "var(--ink)" : "var(--rule)"}`,
                             background: on ? "var(--ink)" : "transparent", color: on ? "var(--bg)" : "var(--ink)" }}>
                {f.label}
              </Link>
            );
          })}
        </div>
        {ledger.length === 0 ? (
          <Empty>No rows on this axis yet.</Empty>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
              <thead>
                <tr style={{ ...smallCaps, color: "var(--mute)", textAlign: "left" }}>
                  <th style={th}>When</th><th style={th}>Axis</th><th style={th}>What produced it</th><th style={{ ...th, textAlign: "right" }}>Source</th>
                </tr>
              </thead>
              <tbody>
                {ledger.slice(0, 40).map((e, i) => (
                  <tr key={i} style={{ borderTop: "1px solid var(--rule)" }}>
                    <td style={{ ...td, font: mono(11), color: "var(--mute)", whiteSpace: "nowrap" }}>{e.at.slice(0, 10)}</td>
                    <td style={{ ...td, font: mono(11), whiteSpace: "nowrap" }}>{AXIS_LABEL[e.axis]}</td>
                    <td style={{ ...td, font: "400 12.5px/1.5 var(--sans)" }}>{e.text}</td>
                    <td style={{ ...td, textAlign: "right" }}><Link href={e.href} style={{ font: mono(11) }}>open →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: "9px 14px", borderTop: "1px solid var(--rule)", font: mono(10.5), color: "var(--mute)" }}>
          showing {Math.min(40, ledger.length)} of {ledger.length} · derived from your records, nothing is weighted or recalculated
        </div>
      </Panel>
    </Page>
  );
}

const th: React.CSSProperties = { padding: "9px 14px", fontWeight: 700 };
const td: React.CSSProperties = { padding: "10px 14px", verticalAlign: "top" };
const num: React.CSSProperties = { ...td, textAlign: "right", font: mono(12.5, 500) };
