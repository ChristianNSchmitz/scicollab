import Link from "next/link";
import type { ReactNode } from "react";
import type { Bibliometrics, RecentChange } from "@/lib/record/bibliometrics";
import type { PubRow } from "@/lib/openalex/store";
import type { Contact } from "@/lib/social/contacts";
import YearBars from "@/components/record/YearBars";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/social/FollowButton";

export type NewPaper = { title: string; who: string | null; href: string };
export type Nudge = { href: string; text: string };

/**
 * The dashboard on top of the feed, kept to one slim band so the feed starts
 * on the first screen: three tiles (citations gained, new papers, people you
 * may know), each one big number and one line, and below them a single row
 * of chips for what is waiting on you. On a phone the tiles shrink to three
 * numbers side by side and the chips scroll sideways.
 */
export default function Highlights({ biblio, change, pubs, papers, contacts, nudges }: {
  biblio: Bibliometrics; change: RecentChange; pubs: PubRow[]; papers: NewPaper[]; contacts: Contact[]; nudges: Nudge[];
}) {
  const ok = biblio.state === "ok" ? biblio : null;
  const gain = change.gain;
  const hot = [...pubs].map((p) => ({ p, d: p.cited_by_count - p.prev_cited_by_count })).filter((x) => x.d > 0).sort((a, b) => b.d - a.d)[0];
  const perYear = ok ? ok.countsByYear.filter((x) => x.year > ok.year - 6).map((x) => ({ year: x.year, value: x.cited_by_count })) : [];
  const top = contacts[0];

  return (
    <section aria-label="Dashboard" style={{ marginBottom: 14 }}>
      <div className="sc-hl">
        <Tile
          href={ok ? "/you/publications?sort=change" : "/settings#orcid"}
          kicker="Citations"
          fresh={!!gain && gain > 0}
          big={ok ? (gain !== null ? `${gain > 0 ? "+" : ""}${gain}` : String(ok.citationsThisYear)) : "–"}
          unit={ok ? (gain !== null ? "in 30 days" : `in ${ok.year}`) : "link ORCID"}
          aside={perYear.length > 1 ? <div style={{ width: 64 }}><YearBars points={perYear} unit="citations" height={22} labels={false} current={ok!.year} /></div> : null}
        >
          {ok ? <>{ok.citations} total · h-index {ok.hIndex}{hot ? <> · most cited now: {hot.p.title}</> : null}</>
            : "Link your ORCID and citations are tracked here."}
        </Tile>

        <Tile href="/home?feed=following#feed" kicker="New papers" short="Papers" fresh={papers.length > 0} big={String(papers.length)} unit="this month">
          {papers.length ? <><b style={{ fontWeight: 600 }}>{papers[0].who ?? "You"}</b> · {papers[0].title}</> : "Nothing new; checked every 12 hours."}
        </Tile>

        <Tile href="/network" kicker="People you may know" short="People" fresh={contacts.length > 0} big={String(contacts.length)} unit="to meet"
          aside={top ? <span className="sc-hl-follow"><FollowButton personId={top.person.id} following={false} compact /></span> : null}>
          {top ? (
            <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
              <span style={{ display: "inline-flex", flex: "none" }}>
                {contacts.slice(0, 3).map((c, i) => (
                  <span key={c.person.id} style={{ marginLeft: i ? -6 : 0, display: "inline-flex", outline: "2px solid var(--surface)" }}>
                    <Avatar name={c.person.display_name} url={c.person.avatar_url} size={18} />
                  </span>
                ))}
              </span>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}><b style={{ fontWeight: 600 }}>{top.person.display_name}</b> · {top.reason}</span>
            </span>
          ) : "You follow everyone we would suggest."}
        </Tile>
      </div>

      {nudges.length > 0 && (
        <nav aria-label="Waiting on you" className="sc-chips">
          {nudges.map((n) => <Link key={n.text} href={n.href} className="sc-chip">{n.text} →</Link>)}
        </nav>
      )}
    </section>
  );
}

function Tile({ href, kicker, short, big, unit, fresh, aside, children }: {
  href: string; kicker: string; short?: string; big: string; unit: string; fresh: boolean; aside?: ReactNode; children: ReactNode;
}) {
  return (
    <div className="sc-hl-tile">
      <Link href={href} className="sc-hl-main" aria-label={`${kicker}: ${big} ${unit}`}>
        <span className="sc-hl-kicker">{fresh && <span className="sc-hl-dot" aria-hidden="true" />}<span className="sc-long">{kicker}</span><span className="sc-short" aria-hidden="true">{short ?? kicker}</span></span>
        <span className="sc-hl-num">
          <span className="sc-hl-big" style={{ color: fresh ? "var(--signal-ink)" : "var(--ink)" }}>{big}</span>
          <span className="sc-hl-unit">{unit}</span>
        </span>
        <span className="sc-hl-detail">{children}</span>
      </Link>
      {aside && <div className="sc-hl-aside">{aside}</div>}
    </div>
  );
}
