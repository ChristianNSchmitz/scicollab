import type { PubRow } from "@/lib/openalex/store";
import type { CitationProfile } from "@/lib/record/citations";
import { lastYearOf, pubLink, thisYearOf } from "@/lib/record/publications";
import YearBars from "@/components/record/YearBars";
import { mono } from "@/components/ui";

/** One publication with its current numbers: total citations, this year,
 *  last year, the change since the last sync, and a six-year trend. */
export default function PublicationRow({ p, c, isNew, detailed = false }: {
  p: PubRow; c: CitationProfile; isNew: boolean; detailed?: boolean;
}) {
  const d = p.cited_by_count - p.prev_cited_by_count;
  const href = pubLink(p);
  const trend = c.trend.get(p.openalex_id) ?? [];
  const now = thisYearOf(p, c), before = lastYearOf(p, c);
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
      <div style={{ flex: "1 1 320px", minWidth: 0 }}>
        <div style={{ font: "500 13.5px/1.45 var(--sans)" }}>
          {isNew && <span className="sc-badge" style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: "var(--ok)", border: "1px solid var(--ok)", padding: "1px 5px", marginRight: 7 }}>NEW</span>}
          {href ? <a href={href} target="_blank" rel="noreferrer" style={{ color: "var(--ink)" }}>{p.title || "Untitled"}</a> : (p.title || "Untitled")}
        </div>
        <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 3 }}>
          {[p.venue, p.year, p.type, detailed && p.doi ? `doi ${p.doi}` : null].filter(Boolean).join(" · ")}
        </div>
      </div>
      {c.hasHistory && trend.some((n) => n > 0) && (
        <div style={{ width: 72, flex: "none" }} title={`Citations per year, ${c.trendYears[0]}–${c.year}`}>
          <YearBars points={c.trendYears.map((y, i) => ({ year: y, value: trend[i] }))} unit="citations" height={20} labels={false} current={c.year} />
        </div>
      )}
      {detailed && c.hasHistory && (
        <div style={{ textAlign: "right", whiteSpace: "nowrap", minWidth: 92, font: mono(10.5), color: "var(--mute)", lineHeight: 1.6 }}>
          <div><b style={{ color: "var(--ink)" }}>{now}</b> in {c.year}</div>
          <div>{before} in {c.year - 1}</div>
        </div>
      )}
      <div style={{ textAlign: "right", whiteSpace: "nowrap", minWidth: 96 }}>
        <span style={{ font: mono(13, 600) }}>{p.cited_by_count}</span>
        <span style={{ font: mono(10.5), color: "var(--mute)" }}> {p.cited_by_count === 1 ? "citation" : "citations"}</span>
        {!detailed && now > 0 && <div style={{ font: mono(10.5), color: "var(--mute)" }}>{now} in {c.year}</div>}
        {d !== 0 && <div style={{ font: mono(10.5), color: d > 0 ? "var(--ok)" : "var(--mute)" }}>{d > 0 ? "+" : ""}{d} since last sync</div>}
      </div>
    </div>
  );
}
