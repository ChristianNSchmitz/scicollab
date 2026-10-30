import Link from "next/link";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import Reactions from "@/components/social/Reactions";
import RichText from "@/components/RichText";
import { PostImages, LinkCard } from "@/components/feed/PostMedia";
import { Panel, Outcome, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById, housesOfRoom, intentById } from "@/lib/taxonomy";
import type { Person } from "@/lib/people";
import type { ReactionSummary } from "@/lib/social/reactions";

const INTENT_COLOUR: Record<string, string> = {
  result: "var(--ok)", data_question: "var(--info)", general: "var(--mute)", collab: "var(--signal-ink)", update: "var(--ink)",
};

/** The first `max` characters, cut at a word and marked as cut. */
function excerpt(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max * 0.6)).trimEnd() + "…";
}

/**
 * One post in a list: who, what kind, where (a topic group, or a group's own
 * discussion), the text, images, link preview, method card, the call for
 * collaborators, reactions and the way to the replies. Used by the feed and
 * by the discussions on group pages.
 */
export default function PostCard({ p, author, card, images, reaction, replies, me, path, topicHref, group }: {
  p: any; author?: Person; card?: { id: string; code: string; title: string; outcome: any } | null;
  images?: string[]; reaction?: ReactionSummary; replies: number; me: string; path: string;
  topicHref: (room: string) => string; group?: { id: string; name: string } | null;
}) {
  const spec = intentById(p.intent);
  return (
    <article id={`post-${p.id}`} style={{ scrollMarginTop: 72 }}>
      <Panel>
        <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
          <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={28} />
          <div style={{ minWidth: 0 }}>
            <PersonLink id={p.author_id} style={{ font: mono(12.5, 600) }}>{author?.display_name ?? "Someone"}</PersonLink>
            <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 2 }}>
              {author?.institution ? `${author.institution} · ` : ""}{timeAgo(p.created_at)}
            </div>
          </div>
          <span style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span className="sc-badge" style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: INTENT_COLOUR[p.intent] ?? "var(--mute)", border: `1px solid ${INTENT_COLOUR[p.intent] ?? "var(--rule)"}`, padding: "3px 7px" }}>
              {(spec?.label ?? p.intent).toUpperCase()}
            </span>
            {p.group_id
              ? (group ? <Link href={`/groups/${group.id}`} style={{ font: mono(11, 500), color: "var(--ink)" }}>{group.name} · members only</Link> : null)
              : <Link href={topicHref(p.room_id)} title={housesOfRoom(p.room_id).length > 1 ? `shared across ${housesOfRoom(p.room_id).length} fields` : roomById(p.room_id)?.name} style={{ font: mono(11, 500), color: "var(--ink)" }}>#{p.room_id}</Link>}
          </span>
        </div>

        <div style={{ padding: 14 }}>
          <Link href={`/posts/${p.id}`} style={{ font: mono(15, 700, 1.35), color: "var(--ink)", textDecoration: "none" }}>{p.title}</Link>
          {p.body && <div style={{ marginTop: 8 }}><RichText body={excerpt(p.body, 400)} style={{ font: "400 13.5px/1.65 var(--sans)" }} /></div>}
          <PostImages urls={images} title={p.title} />
          <LinkCard preview={p.link_preview} />

          {card && (
            <Link href={`/methods/${card.id}`} style={{ display: "block", marginTop: 11, border: "1px solid var(--rule)", background: "var(--bg)", padding: "10px 12px", color: "var(--ink)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Outcome value={card.outcome} />
                <span style={{ font: mono(10.5), color: "var(--mute)" }}>{card.code}</span>
              </div>
              <div style={{ font: mono(12.5, 500), marginTop: 6 }}>{card.title}</div>
            </Link>
          )}

          {p.intent === "collab" && (p.technique || p.offer || p.deadline) && (
            <div style={{ marginTop: 11, border: "1px solid var(--signal)", padding: "10px 12px" }}>
              <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal-ink)", marginBottom: 6 }}>WHAT IS NEEDED</div>
              <div style={{ font: mono(11.5, 400, 1.7) }}>
                {p.technique && <div>technique · {p.technique}</div>}
                {p.organism && <div>system · {p.organism}</div>}
                {p.deadline && <div>by · {p.deadline}</div>}
                {p.offer && <div>offered back · {p.offer}</div>}
              </div>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", padding: "9px 14px", borderTop: "1px solid var(--rule)" }}>
          <Reactions kind="post" targetId={p.id} summary={reaction} own={p.author_id === me} path={path} />
          <Link href={`/posts/${p.id}#replies`} style={{ marginLeft: "auto", font: mono(11, 500), color: "var(--mute)", textDecoration: "none" }}>
            {replies === 0 ? "Reply →" : `${replies} ${replies === 1 ? "reply" : "replies"} →`}
          </Link>
        </div>
      </Panel>
    </article>
  );
}
