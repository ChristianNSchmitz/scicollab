import Link from "next/link";
import type { ReactNode } from "react";
import type { Bibliometrics, RecentChange } from "@/lib/record/bibliometrics";
import type { PubRow } from "@/lib/openalex/store";
import type { Contact } from "@/lib/social/contacts";
import YearBars from "@/components/record/YearBars";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/social/FollowButton";
import { Panel, PanelHead } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export type Nudge = { href: string; text: string };
/** Someone's reply to one of your posts, or answer to one of your questions. */
export type Response = { id: string; href: string; who: string; whoId: string; avatar: string | null; snippet: string; about: string; at: string; others: number };

/** How many replies the column shows; the rest are one click away. */
export const RESPONSES_SHOWN = 3;

/**
 * The column on the right of the feed. From the top: your citations (one
 * tile), who has replied to what you asked, a few people you may want to
 * follow, and a reserved slot for advertising. Each part says nothing when it
 * has nothing to say, except the ad slot, which keeps its place.
 */
export default function FeedSidebar({ biblio, change, pubs, contacts, responses, moreResponses }: {
  biblio: Bibliometrics; change: RecentChange; pubs: PubRow[]; contacts: Contact[]; responses: Response[]; moreResponses: number;
}) {
  return (
    <aside aria-label="Your activity" className="sc-feed-aside">
      <Citations biblio={biblio} change={change} pubs={pubs} />
      <Responses items={responses} more={moreResponses} />
      <People contacts={contacts} />
      <AdSlot />
    </aside>
  );
}

function Citations({ biblio, change, pubs }: { biblio: Bibliometrics; change: RecentChange; pubs: PubRow[] }) {
  const ok = biblio.state === "ok" ? biblio : null;
  const gain = change.gain;
  const fresh = !!gain && gain > 0;
  const hot = [...pubs].map((p) => ({ p, d: p.cited_by_count - p.prev_cited_by_count })).filter((x) => x.d > 0).sort((a, b) => b.d - a.d)[0];
  const perYear = ok ? ok.countsByYear.filter((x) => x.year > ok.year - 6).map((x) => ({ year: x.year, value: x.cited_by_count })) : [];
  const big = ok ? (gain !== null ? `${gain > 0 ? "+" : ""}${gain}` : String(ok.citationsThisYear)) : "–";
  const unit = ok ? (gain !== null ? "in 30 days" : `in ${ok.year}`) : "link ORCID";
  const detail = ok ? `${ok.citations} total · h-index ${ok.hIndex}${hot ? ` · most cited now: ${hot.p.title}` : ""}` : "Link your ORCID and citations are tracked here.";
  return (
    <div className="sc-hl-tile">
      <Link href={ok ? "/you/publications?sort=change" : "/settings#orcid"} className="sc-hl-main" aria-label={`Citations: ${big} ${unit}`}>
        <span className="sc-hl-kicker">{fresh && <span className="sc-hl-dot" aria-hidden="true" />}Citations</span>
        <span className="sc-hl-num">
          <span className="sc-hl-big" style={{ color: fresh ? "var(--signal-ink)" : "var(--ink)" }}>{big}</span>
          <span className="sc-hl-unit">{unit}</span>
        </span>
        <span className="sc-hl-detail" title={detail}>{detail}</span>
      </Link>
      {perYear.length > 1 && <div className="sc-hl-aside"><div style={{ width: 64 }}><YearBars points={perYear} unit="citations" height={22} labels={false} current={ok!.year} /></div></div>}
    </div>
  );
}

function Block({ title, children, foot }: { title: string; children: ReactNode; foot?: ReactNode }) {
  return (
    <Panel>
      <PanelHead>{title}</PanelHead>
      {children}
      {foot && <div style={{ padding: "7px 12px", borderTop: "1px solid var(--rule)" }}>{foot}</div>}
    </Panel>
  );
}

const seeAll = { font: "600 12.5px/1.4 var(--sans)", color: "var(--link)", textDecoration: "none" } as const;

function Responses({ items, more }: { items: Response[]; more: number }) {
  return (
    <Block title="Replies to you" foot={items.length ? <Link href="/notifications" style={seeAll}>{more > 0 ? `${more} more · ` : ""}All replies →</Link> : undefined}>
      {items.length === 0 ? (
        <p style={{ margin: 0, padding: "9px 12px", font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)" }}>
          No replies yet. When someone answers a post or question of yours, it shows here.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((r, i) => (
            <li key={r.id} style={{ borderTop: i ? "1px solid var(--rule)" : 0 }}>
              <Link href={r.href} title={`${r.who}: “${r.snippet}”\non ${r.about}`} style={{ display: "flex", gap: 8, padding: "7px 12px", color: "var(--ink)", textDecoration: "none" }}>
                <Avatar name={r.who} url={r.avatar} size={22} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "flex", gap: 6, font: "600 12.5px/1.4 var(--sans)" }}>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.about}</span>
                    <span style={{ flex: "none", font: "400 11.5px/1.5 var(--sans)", color: "var(--mute)" }}>{timeAgo(r.at)}</span>
                  </span>
                  <span style={{ display: "block", font: "400 12px/1.4 var(--sans)", color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    <b style={{ fontWeight: 600, color: "var(--ink)" }}>{r.who}{r.others > 0 ? ` +${r.others}` : ""}</b> “{r.snippet}”
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}

function People({ contacts }: { contacts: Contact[] }) {
  return (
    <div className="sc-hide-narrow">
      <Block title="People you may know" foot={<Link href="/network" style={seeAll}>More people →</Link>}>
        {contacts.length === 0 ? (
          <p style={{ margin: 0, padding: "9px 12px", font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)" }}>You follow everyone we would suggest.</p>
        ) : (
          <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {contacts.slice(0, 3).map(({ person, reason }, i) => (
              <li key={person.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 12px", borderTop: i ? "1px solid var(--rule)" : 0 }}>
                <Avatar name={person.display_name} url={person.avatar_url} size={26} />
                <Link href={`/people/${person.id}`} style={{ flex: 1, minWidth: 0, color: "var(--ink)", textDecoration: "none" }}>
                  <span style={{ display: "block", font: "600 12.5px/1.35 var(--sans)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{person.display_name}</span>
                  <span style={{ display: "block", font: "400 11.5px/1.35 var(--sans)", color: "var(--mute)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{reason || person.institution}</span>
                </Link>
                <FollowButton personId={person.id} following={false} compact />
              </li>
            ))}
          </ul>
        )}
      </Block>
    </div>
  );
}

/**
 * Room for advertising, at the size ad networks call a medium rectangle
 * (300 × 250). Nothing is served yet: this keeps the place so the column does
 * not move when something is. Put the ad inside this element.
 */
function AdSlot() {
  return (
    <aside aria-label="Advertisement" className="sc-ad sc-hide-narrow">
      <span>Advertisement</span>
    </aside>
  );
}
