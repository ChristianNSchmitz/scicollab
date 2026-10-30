import Link from "next/link";
import type { ReactNode } from "react";
import type { Bibliometrics, RecentChange } from "@/lib/record/bibliometrics";
import type { PubRow } from "@/lib/openalex/store";
import type { Contact } from "@/lib/social/contacts";
import YearBars from "@/components/record/YearBars";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/social/FollowButton";
import { mono } from "@/components/ui";

export type NewPaper = { title: string; who: string | null; href: string };

/**
 * The top of the landing page: three tiles that say, at a glance, what is
 * new since you last looked. Citations gained, papers that came out (yours
 * and from people you follow) and people worth knowing. Each is one number,
 * one line of detail and one way to go further; the full views are a click
 * away.
 */
export default function Highlights({ biblio, change, pubs, papers, contacts }: {
  biblio: Bibliometrics; change: RecentChange; pubs: PubRow[]; papers: NewPaper[]; contacts: Contact[];
}) {
  const ok = biblio.state === "ok" ? biblio : null;
  const gain = change.gain;
  const hot = [...pubs].map((p) => ({ p, d: p.cited_by_count - p.prev_cited_by_count })).filter((x) => x.d > 0).sort((a, b) => b.d - a.d)[0];
  const perYear = ok ? ok.countsByYear.filter((x) => x.year > ok.year - 8).map((x) => ({ year: x.year, value: x.cited_by_count })) : [];

  return (
    <section aria-label="What is new" className="sc-hl">
      <Tile
        kicker="Citations"
        fresh={!!gain && gain > 0}
        big={ok ? (gain !== null ? `${gain > 0 ? "+" : ""}${gain}` : String(ok.citationsThisYear)) : "ORCID"}
        unit={ok ? (gain !== null ? "in the last 30 days" : `this year, ${ok.year}`) : "not linked yet"}
        foot={<Link href={ok ? "/you/publications?sort=change" : "/settings#orcid"}>{ok ? "Which papers →" : "Link ORCID →"}</Link>}
      >
        {!ok && <div style={line}>Your citations, h-index and new papers are then tracked here automatically, checked every 12 hours.</div>}
        {ok && (
          <>
            <div style={{ font: mono(11.5, 500), color: "var(--mute)" }}>{ok.citations} total · h-index {ok.hIndex}</div>
            {perYear.length > 1 && <div style={{ marginTop: 8 }}><YearBars points={perYear} unit="citations" height={30} labels={false} current={ok.year} /></div>}
            {hot && <div style={line}>Most cited right now: <strong style={{ fontWeight: 600 }}>{cut(hot.p.title, 70)}</strong> <span style={{ color: "var(--ok)" }}>+{hot.d}</span></div>}
          </>
        )}
      </Tile>

      <Tile
        kicker="New papers"
        fresh={papers.length > 0}
        big={String(papers.length)}
        unit={papers.length === 1 ? "this month" : "this month, yours and from people you follow"}
        foot={<Link href="/home?feed=following#feed">From people you follow →</Link>}
      >
        {papers.length === 0
          ? <div style={line}>Nothing new this month. Publications are checked every 12 hours.</div>
          : papers.slice(0, 2).map((p, i) => (
            <a key={i} href={p.href} {...(p.href.startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})} style={{ ...line, display: "block", color: "var(--ink)", textDecoration: "none" }}>
              <span style={{ font: mono(10.5, 600), color: "var(--signal-ink)" }}>{p.who ?? "You"}</span> · {cut(p.title, 80)}
            </a>
          ))}
      </Tile>

      <Tile
        kicker="People you may know"
        fresh={contacts.length > 0}
        big={String(contacts.length)}
        unit={contacts.length === 1 ? "suggestion" : "suggestions"}
        foot={<Link href="/network">See everyone →</Link>}
      >
        {contacts.length === 0
          ? <div style={line}>You follow everyone we would suggest. Invite co-authors from the Network page.</div>
          : contacts.slice(0, 3).map((c) => (
            <div key={c.person.id} style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 7 }}>
              <Avatar name={c.person.display_name} url={c.person.avatar_url} size={26} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/people/${c.person.id}`} style={{ font: mono(12, 600), color: "var(--ink)" }}>{c.person.display_name}</Link>
                <div style={{ font: "400 11.5px/1.3 var(--sans)", color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.reason}</div>
              </div>
              <FollowButton personId={c.person.id} following={false} compact />
            </div>
          ))}
      </Tile>
    </section>
  );
}

const line = { font: "400 12.5px/1.45 var(--sans)", marginTop: 8 } as const;
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);

function Tile({ kicker, big, unit, fresh, foot, children }: { kicker: string; big: string; unit: string; fresh: boolean; foot: ReactNode; children: ReactNode }) {
  return (
    <div className="sc-hl-tile">
      <div style={{ display: "flex", alignItems: "center", gap: 7, font: mono(10, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)" }}>
        {fresh && <span className="sc-hl-dot" aria-hidden="true" />}{kicker}
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
        <span className="sc-hl-big" style={{ color: fresh ? "var(--signal-ink)" : "var(--ink)" }}>{big}</span>
        <span style={{ font: "400 12.5px/1.3 var(--sans)", color: "var(--mute)" }}>{unit}</span>
      </div>
      <div style={{ flex: 1, marginTop: 4 }}>{children}</div>
      <div className="sc-hl-foot">{foot}</div>
    </div>
  );
}
