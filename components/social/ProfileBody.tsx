import Link from "next/link";
import type { ReactNode } from "react";
import type { ProfileData } from "@/lib/social/profile";
import { Panel, PanelHead, Outcome, Tag, Visibility, mono } from "@/components/ui";
import PublicationRow from "@/components/record/PublicationRow";
import Avatar from "@/components/Avatar";
import { orcidUrl } from "@/lib/orcid";
import { timeAgo } from "@/lib/format";

const row = { display: "flex", gap: 10, alignItems: "baseline", padding: "10px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" } as const;
const quiet = { padding: "12px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" } as const;

/**
 * The body of a profile, shared by the member view (/people/[id]) and the
 * page signed-out visitors see when someone made their profile public. Each
 * number stands on its own with its source; nothing is added up into a score.
 */
export default function ProfileBody({ d, publicView = false, side }: { d: ProfileData; publicView?: boolean; side?: ReactNode }) {
  const { person, biblio } = d;
  const topPubs = [...d.pubs].sort((a, b) => b.cited_by_count - a.cited_by_count).slice(0, 6);
  const facts: [string, string | number, string?][] = [
    ["Method cards", d.counts.cards],
    ["Null results recorded", d.counts.nulls],
    ["Answers", d.counts.answers, d.counts.accepted ? `${d.counts.accepted} accepted` : undefined],
    ["Questions", d.counts.questions],
    ...(biblio.state === "ok"
      ? ([["Publications", biblio.works, "OpenAlex"], ["Citations", biblio.citations, "OpenAlex"], ["h-index", biblio.hIndex, "OpenAlex"]] as [string, number, string][])
      : []),
  ];
  const memberHref = (path: string) => (publicView ? "/login?next=" + encodeURIComponent(path) : path);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {(person.bio || person.techniques.length > 0 || person.orcid) && (
        <Panel style={{ padding: 14 }}>
          {person.bio && <p style={{ margin: "0 0 10px", font: "400 14px/1.65 var(--sans)", whiteSpace: "pre-wrap" }}>{person.bio}</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {person.techniques.map((t) => <Tag key={t}>{t}</Tag>)}
            {person.orcid && (
              <a href={orcidUrl(person.orcid)} target="_blank" rel="noreferrer" style={{ font: mono(11), color: "var(--link)", marginLeft: person.techniques.length ? 6 : 0 }}>
                ORCID {person.orcid}
              </a>
            )}
          </div>
        </Panel>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 8 }}>
        {facts.map(([label, value, note]) => (
          <Panel key={label} style={{ padding: "10px 12px" }}>
            <div style={{ font: mono(10, 700), letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mute)" }}>{label}</div>
            <div style={{ font: mono(22, 700), marginTop: 6 }}>{value}</div>
            {note && <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 3 }}>{note}</div>}
          </Panel>
        ))}
      </div>

      <div className="sc-pair" style={{ gap: 14, alignItems: "start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <Panel>
            <PanelHead>Method cards · {d.cards.length}</PanelHead>
            {d.cards.length === 0 ? <div style={quiet}>No {publicView ? "public " : ""}method cards yet.</div>
              : d.cards.slice(0, 8).map((c) => (
                <Link key={c.id} href={`/methods/${c.id}`} style={{ ...row, flexWrap: "wrap" }}>
                  <span style={{ font: mono(11, 500), color: "var(--mute)" }}>{c.code}</span>
                  <span style={{ flex: "1 1 200px", font: "500 13.5px/1.45 var(--sans)" }}>{c.title}</span>
                  <Outcome value={c.outcome} />
                  {!publicView && <Visibility value={c.visibility as "private" | "lab" | "public"} />}
                </Link>
              ))}
          </Panel>

          <Panel>
            <PanelHead>Answers · {d.answers.length}</PanelHead>
            {d.answers.length === 0 ? <div style={quiet}>No answers yet.</div>
              : d.answers.slice(0, 6).map((a) => (
                <Link key={a.id} href={memberHref(`/questions/${a.question_id}`)} style={row}>
                  <span style={{ flex: 1, font: "400 13.5px/1.45 var(--sans)" }}>{a.title}</span>
                  {a.accepted && <span style={{ font: mono(10, 700), color: "var(--ok)" }}>ACCEPTED</span>}
                  <span style={{ font: mono(10.5), color: "var(--mute)", whiteSpace: "nowrap" }}>{timeAgo(a.created_at)}</span>
                </Link>
              ))}
          </Panel>

          {d.questions.length > 0 && (
            <Panel>
              <PanelHead>Questions · {d.questions.length}</PanelHead>
              {d.questions.slice(0, 5).map((q) => (
                <Link key={q.id} href={memberHref(`/questions/${q.id}`)} style={row}>
                  <span style={{ flex: 1, font: "400 13.5px/1.45 var(--sans)" }}>{q.title}</span>
                  <span style={{ font: mono(10.5), color: "var(--mute)", whiteSpace: "nowrap" }}>{timeAgo(q.created_at)}</span>
                </Link>
              ))}
            </Panel>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          <Panel>
            <PanelHead>Most cited publications{d.pubs.length ? ` · ${d.pubs.length}` : ""}</PanelHead>
            {topPubs.length === 0
              ? <div style={quiet}>{person.orcid ? "Publications appear here after the first sync from OpenAlex." : "No ORCID linked, so no publications are shown."}</div>
              : topPubs.map((p) => <PublicationRow key={p.openalex_id} p={p} c={d.citations} isNew={false} />)}
          </Panel>
          {side}
          {d.groups.length > 0 && (
            <Panel>
              <PanelHead>Groups</PanelHead>
              {d.groups.map((g) => (
                <Link key={g.id} href={`/groups/${g.id}`} style={row}>
                  <span style={{ flex: 1, font: mono(12.5, 500) }}>{g.name}</span>
                  {g.role === "owner" && <Tag>owner</Tag>}
                </Link>
              ))}
            </Panel>
          )}
          {d.sharedRooms.length > 0 && (
            <Panel>
              <PanelHead>Topic groups you share</PanelHead>
              <div style={{ padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: 8 }}>
                {d.sharedRooms.map((r) => (
                  <Link key={r.id} href={`/home?room=${r.id}`} style={{ font: mono(12, 500), color: "var(--ink)" }}>#{r.label}</Link>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}

/** Name, picture and line under it; the same on both views. */
export function ProfileHead({ d, actions }: { d: ProfileData; actions?: ReactNode }) {
  const p = d.person;
  return (
    <header className="sc-page-head" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16, marginBottom: 18, paddingBottom: 14, borderBottom: "1px solid var(--ink)" }}>
      <Avatar name={p.display_name} url={p.avatar_url} size={64} />
      <div style={{ flex: "1 1 240px", minWidth: 0 }}>
        <h1 className="sc-title" style={{ font: mono(20, 700, 1.2), margin: 0, letterSpacing: "-.02em" }}>{p.display_name || "Researcher"}</h1>
        <p style={{ font: "400 13.5px/1.6 var(--sans)", color: "var(--mute)", margin: "5px 0 0" }}>
          {[p.role_title, p.institution, p.field].filter(Boolean).join(" · ") || "No role or institution given yet."}
        </p>
        <p style={{ font: mono(10.5), color: "var(--mute)", margin: "4px 0 0" }}>Member since {p.created_at.slice(0, 7)}</p>
      </div>
      {actions}
    </header>
  );
}
