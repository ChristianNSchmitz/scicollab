import Link from "next/link";
import type { Bibliometrics, RecentChange } from "@/lib/record/bibliometrics";
import type { CitationProfile } from "@/lib/record/citations";
import type { PubRow } from "@/lib/openalex/store";
import { thisYearOf } from "@/lib/record/publications";
import { syncNow } from "@/app/actions/openalex";
import YearBars from "@/components/record/YearBars";
import { Panel, PanelHead, btn, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

/**
 * The dashboard's citation tracker: where the numbers stand, how they moved
 * in the last 30 days and this year, which papers are being cited now, and
 * one way through to the full list of publications.
 */
export default function CitationTracker({ biblio, change, c, pubs }: {
  biblio: Bibliometrics; change: RecentChange; c: CitationProfile; pubs: PubRow[];
}) {
  if (biblio.state !== "ok") {
    return (
      <Panel>
        <PanelHead>Citation tracker</PanelHead>
        <div style={{ padding: 14, font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>
          {biblio.state === "no-orcid" || biblio.state === "invalid-orcid" ? (
            <>Link your ORCID and your citations, h-index and new publications are tracked here automatically.{" "}
              <Link href="/settings#orcid" style={{ color: "var(--link)" }}>Link ORCID</Link></>
          ) : biblio.state === "pending" ? "Fetching your record from OpenAlex for the first time…"
            : biblio.state === "not-found" ? "OpenAlex has no author for your ORCID yet. It is checked again on every sync."
            : "OpenAlex could not be reached. The next sync will try again."}
        </div>
      </Panel>
    );
  }

  const b = biblio;
  const h = c.hIndexByYear;
  const hDelta = h.length > 1 ? h.at(-1)!.value - h.at(-2)!.value : null;
  const lastYear = b.countsByYear.find((x) => x.year === b.year - 1)?.cited_by_count ?? 0;
  const perYear = b.countsByYear.filter((x) => x.year > b.year - 8).map((x) => ({ year: x.year, value: x.cited_by_count }));

  // Papers being cited now: biggest gain since the last sync, then this year.
  const moving = [...pubs]
    .map((p) => ({ p, gain: p.cited_by_count - p.prev_cited_by_count, now: thisYearOf(p, c) }))
    .filter((x) => x.gain > 0 || x.now > 0)
    .sort((a, z) => z.gain - a.gain || z.now - a.now)
    .slice(0, 3);

  const sign = (n: number) => `${n > 0 ? "+" : ""}${n}`;
  const cell: React.CSSProperties = { background: "var(--surface)", padding: "11px 14px" };

  return (
    <Panel>
      <PanelHead>Citation tracker</PanelHead>
      <div className="sc-pair" style={{ gap: 1, background: "var(--rule)", borderBottom: "1px solid var(--rule)" }}>
        <div style={cell}>
          <div style={{ font: mono(22, 700), letterSpacing: "-.02em" }}>{b.citations.toLocaleString("en-GB")}</div>
          <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 4 }}>citations</div>
          <div style={{ font: mono(10), color: change.gain ? "var(--ok)" : "var(--mute)", marginTop: 3 }}>
            {change.gain !== null ? `${sign(change.gain)} in 30 days` : `${b.citationsThisYear} in ${b.year}`}
          </div>
        </div>
        <div style={cell}>
          <div style={{ font: mono(22, 700), letterSpacing: "-.02em" }}>{b.hIndex}</div>
          <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 4 }}>h-index · i10 {b.i10}</div>
          <div style={{ font: mono(10), color: "var(--mute)", marginTop: 3 }}>
            {hDelta === null ? `${b.works} works` : `${sign(hDelta)} since ${b.year - 1}`}
          </div>
        </div>
      </div>

      <div style={{ padding: "11px 14px 4px" }}>
        <YearBars points={perYear} unit="citations" current={b.year} height={34} />
        <div style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 6 }}>
          <b style={{ color: "var(--ink)" }}>{b.citationsThisYear}</b> so far in {b.year} · {lastYear} in {b.year - 1}
        </div>
      </div>

      {moving.length > 0 && (
        <div style={{ padding: "8px 14px 4px" }}>
          <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 6 }}>BEING CITED NOW</div>
          {moving.map(({ p, gain, now }) => (
            <div key={p.openalex_id} style={{ display: "flex", gap: 8, font: "400 12.5px/1.4 var(--sans)", marginBottom: 6 }}>
              <span style={{ font: mono(11, 700), minWidth: 34, textAlign: "right", color: gain > 0 ? "var(--ok)" : "var(--ink)" }}>
                {gain > 0 ? sign(gain) : now}
              </span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{p.title}</span>
            </div>
          ))}
        </div>
      )}

      {change.newPubs.length > 0 && (
        <div style={{ padding: "4px 14px 6px", font: "400 12.5px/1.5 var(--sans)" }}>
          <b>{change.newPubs.length}</b> new publication{change.newPubs.length > 1 ? "s" : ""} in 30 days
          {change.newPubs.slice(0, 2).map((p) => (
            <div key={p.openalex_id} style={{ font: mono(10.5), color: "var(--mute)", marginTop: 3 }}>· {p.title}</div>
          ))}
        </div>
      )}

      <div style={{ padding: "6px 14px 0", font: mono(10.5), color: "var(--mute)" }}>
        {b.example ? "example values · demo account" : `OpenAlex · checked ${timeAgo(b.updated)}`}
      </div>
      <div style={{ padding: "10px 14px 14px", display: "flex", gap: 6 }}>
        <Link href="/you/publications" style={{ ...btn, flex: 1, justifyContent: "center" }}>All {pubs.length || b.works} publications →</Link>
        {!b.example && (
          <form action={syncNow.bind(null, "/home")}><button type="submit" style={btn} title="Check OpenAlex now">Sync</button></form>
        )}
      </div>
    </Panel>
  );
}
