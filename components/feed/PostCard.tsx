import Link from "next/link";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import Reactions from "@/components/social/Reactions";
import RichText from "@/components/RichText";
import { PostImages, LinkCard } from "@/components/feed/PostMedia";
import PostActions from "@/components/feed/PostActions";
import PostMenu from "@/components/feed/PostMenu";
import ExpandText from "@/components/feed/ExpandText";
import FollowButton from "@/components/social/FollowButton";
import { Panel, Outcome, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById, housesOfRoom, intentById } from "@/lib/taxonomy";
import type { Person } from "@/lib/people";
import { REACTIONS, type ReactionSummary } from "@/lib/social/reactions";
import type { PostExtra } from "@/lib/posts/extras";

const INTENT_COLOUR: Record<string, string> = {
  result: "var(--ok)", data_question: "var(--info)", general: "var(--mute)", collab: "var(--signal-ink)", update: "var(--ink)",
};


/**
 * One post in a list: who, what kind, where (a topic group, or a group's own
 * discussion), the text, images, link preview, method card, the call for
 * collaborators, reactions, and the ways to respond: reply, repost, send,
 * save. Used by the feed and by the feeds on group pages.
 *
 * `extra` (lib/posts/extras.ts) adds reposts, saving and the line on top
 * that says why the post is in your feed; `follows` says whether you follow
 * the author, so the card can offer to.
 */
export default function PostCard({ p, author, card, images, reaction, replies, me, path, topicHref, group, extra, follows, contextPerson }: {
  p: any; author?: Person; card?: { id: string; code: string; title: string; outcome: any } | null;
  images?: string[]; reaction?: ReactionSummary; replies: number; me: string; path: string;
  topicHref: (room: string) => string; group?: { id: string; name: string } | null;
  extra?: PostExtra; follows?: boolean; contextPerson?: Person;
}) {
  const spec = intentById(p.intent);
  const own = p.author_id === me;
  const reacted = reaction ? REACTIONS.reduce((n, r) => n + reaction.counts[r.key], 0) : 0;
  const reposts = extra?.reposts ?? 0;
  const ctx = extra?.context;
  return (
    <article id={`post-${p.id}`} style={{ scrollMarginTop: 72 }}>
      <Panel>
        {ctx && (
          <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--rule)", font: "400 12.5px/1.45 var(--sans)", color: "var(--mute)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Avatar name={contextPerson?.display_name ?? ""} url={contextPerson?.avatar_url} size={18} />
              <span><PersonLink id={ctx.personId} style={{ font: "600 12.5px/1.45 var(--sans)", color: "var(--ink)" }}>{contextPerson?.display_name ?? "Someone you follow"}</PersonLink> {ctx.text}</span>
            </span>
            {ctx.note && <div style={{ marginTop: 5, color: "var(--ink)", font: "400 13px/1.5 var(--sans)" }}>{ctx.note}</div>}
          </div>
        )}
        <div style={{ padding: "11px 14px", display: "flex", alignItems: "center", gap: 9, borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
          <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={28} />
          <div style={{ minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <PersonLink id={p.author_id} style={{ font: mono(12.5, 600) }}>{author?.display_name ?? "Someone"}</PersonLink>
              {!own && follows === false && <FollowButton personId={p.author_id} following={false} inline />}
            </span>
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
            <PostMenu postId={p.id} saved={extra?.saved ?? false} own={own} />
          </span>
        </div>

        <div style={{ padding: 14 }}>
          <Link href={`/posts/${p.id}`} style={{ font: mono(15, 700, 1.35), color: "var(--ink)", textDecoration: "none" }}>{p.title}</Link>
          {p.body && <div style={{ marginTop: 8 }}><ExpandText long={p.body.length > 280 || p.body.split("\n").length > 4}><RichText body={p.body} style={{ font: "400 13.5px/1.65 var(--sans)" }} /></ExpandText></div>}
          <PostImages urls={images} title={p.title} />
          <LinkCard preview={p.link_preview} />

          {card && (
            <Link href={`/methods/${card.id}`} className="sc-inset" style={{ display: "block", marginTop: 11, border: "1px solid var(--rule)", borderRadius: 12, background: "var(--bg)", padding: "10px 12px", color: "var(--ink)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Outcome value={card.outcome} />
                <span style={{ font: mono(10.5), color: "var(--mute)" }}>{card.code}</span>
              </div>
              <div style={{ font: mono(12.5, 500), marginTop: 6 }}>{card.title}</div>
            </Link>
          )}

          {p.intent === "collab" && (p.technique || p.offer || p.deadline) && (
            <div className="sc-inset" style={{ marginTop: 11, border: "1px solid var(--signal)", borderRadius: 12, padding: "10px 12px" }}>
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
        {(reacted > 0 || replies > 0 || reposts > 0) && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 14px 0", font: "400 12px/1.4 var(--sans)", color: "var(--mute)" }}>
            {reacted > 0 && <span>{reacted} {reacted === 1 ? "reaction" : "reactions"}</span>}
            <span style={{ marginLeft: "auto" }}>
              {[replies > 0 && `${replies} ${replies === 1 ? "reply" : "replies"}`, reposts > 0 && `${reposts} ${reposts === 1 ? "repost" : "reposts"}`].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 8px 14px", borderTop: reacted || replies || reposts ? 0 : "1px solid var(--rule)" }}>
          <Reactions kind="post" targetId={p.id} summary={reaction} own={own} path={path} />
          <PostActions postId={p.id} inGroup={!!p.group_id} own={own} reposted={extra?.reposted ?? false} />
        </div>
      </Panel>
    </article>
  );
}
