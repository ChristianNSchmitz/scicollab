import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Page, Panel, PanelHead, Empty, btn, mono } from "@/components/ui";
import WeeklyBars from "@/components/record/WeeklyBars";
import { loadRecord, AXES, AXIS_LABEL, type Axis } from "@/lib/record/metrics";
import { ensureRecordSeed } from "@/lib/record/demo-seed";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const WINDOWS = [8, 12, 26];

/**
 * Your record — boards B3·16 (personal dashboard) and B3·18 (change log),
 * wired. Private to you. Six axes on six scales, no score, no percentile.
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
  const ledger = axis ? r.events.filter((e) => e.axis === axis) : r.events;
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
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/you/record/export${axis ? `?axis=${axis}` : ""}`} style={btn}>Export CSV</Link>
          <Link href="/you" style={btn}>Profile</Link>
        </div>
      }
    >
      {/* Privacy and policy, stated where the numbers are. */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 16, background: "var(--surface)", border: "1px solid var(--ink)" }}>
        <span style={{ font: mono(10, 700), letterSpacing: ".09em", border: "1px solid var(--ink)", padding: "3px 7px", whiteSpace: "nowrap" }}>ONLY ME</span>
        <span style={{ font: "400 12px/1.55 var(--sans)", color: "var(--ink)", flex: 1 }}>
          This page is private. There is no single score, no percentile and no comparison with other researchers, and no institution can see it per person.
        </span>
        <div style={{ display: "flex", border: "1px solid var(--rule)" }} role="group" aria-label="Time window">
          {WINDOWS.map((w) => (
            <Link key={w} href={q({ weeks: w })} aria-current={w === weeks ? "true" : undefined}
                  style={{ padding: "6px 10px", font: mono(11, 500), textDecoration: "none",
                           background: w === weeks ? "var(--ink)" : "transparent",
                           color: w === weeks ? "var(--bg)" : "var(--ink)" }}>
              {w} wk
            </Link>
          ))}
        </div>
      </div>

      {/* Six axes, six scales. */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, marginBottom: 16 }}>
        {r.axes.map((a) => {
          const signal = a.key === "nulls";
          return (
            <Panel key={a.key} style={signal ? { borderColor: "var(--signal)" } : undefined}>
              <div style={{ padding: "12px 14px 14px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
                  <Link href={q({ axis: a.key }) + "#ledger"} style={{ font: mono(10, 700), letterSpacing: ".1em", textTransform: "uppercase", color: signal ? "var(--signal)" : "var(--ink)", textDecoration: "none" }}>
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
                      <span>{k}</span><span style={{ color: "var(--ink)" }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 12, marginBottom: 16, alignItems: "start" }}>
        <Panel>
          <PanelHead>Where your work went · reuse, not reads</PanelHead>
          {r.reuse.length === 0 ? (
            <Empty>
              {r.axes[0].total + r.axes[1].total === 0
                ? <>Reuse starts with a card. <Link href="/methods/new" style={{ color: "var(--link)" }}>Record a method</Link>, including one that did not work.</>
                : "Nobody has forked or cited your cards yet."}
              {r.privateCards > 0 && <> {r.privateCards} of your cards are private, and others can only reuse what they can see.</>}
            </Empty>
          ) : r.reuse.slice(0, 8).map((e, i) => (
            <Link key={i} href={e.href} style={{ display: "flex", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" }}>
              <span style={{ font: "400 12.5px/1.5 var(--sans)", flex: 1, minWidth: 0 }}>{e.text}</span>
              <span style={{ font: mono(10.5), color: "var(--mute)", whiteSpace: "nowrap" }}>{timeAgo(e.at)}</span>
            </Link>
          ))}
          <div style={{ padding: "9px 14px", font: "400 11px/1.6 var(--sans)", color: "var(--mute)" }}>
            Who read your work is not recorded, by design (board J2). What is shown here is what someone did with it.
          </div>
        </Panel>

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
      </div>

      <div id="ledger" />
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", padding: "8px 14px", borderBottom: "1px solid var(--rule)" }}>
          <span style={{ font: mono(10, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)", marginRight: 6 }}>Ledger · every count, row by row</span>
          {[{ key: null, label: `All · ${r.events.length}` }, ...AXES.map((a) => ({ key: a.key, label: `${a.label} · ${r.events.filter((e) => e.axis === a.key).length}` }))].map((f) => {
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
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ font: mono(10, 700), letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mute)", textAlign: "left" }}>
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
