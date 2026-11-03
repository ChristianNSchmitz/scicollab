import Link from "next/link";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import Reactions from "@/components/social/Reactions";
import RichText from "@/components/RichText";
import { PostImages, LinkCard } from "@/components/feed/PostMedia";
import PostActions, { InlineReply } from "@/components/feed/PostActions";
import PostMenu from "@/components/feed/PostMenu";
import CallActions, { type CallInfo } from "@/components/feed/CallActions";
import ExpandText from "@/components/feed/ExpandText";
import FollowButton from "@/components/social/FollowButton";
import { Panel, Outcome, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById, intentById, feedbackLabel } from "@/lib/taxonomy";
import { fileSize } from "@/lib/social/group-files";
import type { Person } from "@/lib/people";
import { REACTIONS, type ReactionSummary } from "@/lib/social/reactions";
import { doiOf } from "@/lib/posts/doi";
import type { PostExtra } from "@/lib/posts/extras";

/** The kind of post as one short word in the meta line. */
const KIND: Record<string, string> = { result: "Result", data_question: "Data question", general: "Question", collab: "Call", feedback: "Feedback", update: "News" };
/** "Ebro Institute of Cell Biology (EICB), Zaragoza" → "Zaragoza": the city, where there is one. */
const place = (inst?: string | null) => (inst ? (inst.includes(",") ? inst.slice(inst.lastIndexOf(",") + 1).trim() : inst) : "");

const INTENT_COLOUR: Record<string, string> = {
  result: "var(--ok)", data_question: "var(--info)", general: "var(--mute)", collab: "var(--signal-ink)", feedback: "var(--info)", update: "var(--ink)",
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
/** Whether a request for help still waits for it. */
export type HelpStatus = "open" | "answered" | "helped";
const STATUS: Record<HelpStatus, { text: string; colour: string; hint: string }> = {
  open: { text: "Open", colour: "var(--signal-ink)", hint: "No reply yet" },
  answered: { text: "Answered", colour: "var(--mute)", hint: "Has replies" },
  helped: { text: "Helped", colour: "var(--ok)", hint: "A reply helped the author" },
};

export default function PostCard({ p, author, card, images, reaction, replies, me, path, topicHref, group, extra, follows, contextPerson, topReply, moreReplies, status, isNew, call }: {
  p: any; author?: Person; card?: { id: string; code: string; title: string; outcome: any } | null;
  images?: string[]; reaction?: ReactionSummary; replies: number; me: string; path: string;
  topicHref: (room: string) => string; group?: { id: string; name: string } | null;
  extra?: PostExtra; follows?: boolean; contextPerson?: Person;
  /** One reply shown under the post: the one marked helpful, else the latest. */
  topReply?: { body: string; created_at: string; helped?: boolean; author?: Person } | null;
  /** The other replies, oldest first: opened in place with "View all". */
  moreReplies?: { body: string; created_at: string; helped?: boolean; author?: Person }[];
  /** For questions and feedback requests: open, answered or helped. */
  status?: HelpStatus;
  /** Posted since your last visit. */
  isNew?: boolean;
  /** For a call for collaborators: what the viewer has with it. Without it the card shows no way to answer (group feeds). */
  call?: CallInfo;
}) {
  const spec = intentById(p.intent);
  const own = p.author_id === me;
  const reacted = reaction ? REACTIONS.reduce((n, r) => n + reaction.counts[r.key], 0) : 0;
  const reposts = extra?.reposts ?? 0;
  const ctx = extra?.context;
  return (
    <article id={`post-${p.id}`} data-post={p.id} data-author={p.author_id} data-room={p.group_id ? undefined : p.room_id} className="sc-post" style={{ scrollMarginTop: 72 }}>
      <Panel>
        {ctx && (
          <div style={{ padding: "10px 14px 0", font: "400 12.5px/1.55 var(--sans)", color: "var(--mute)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <Avatar name={contextPerson?.display_name ?? ""} url={contextPerson?.avatar_url} size={18} />
              <span><PersonLink id={ctx.personId} style={{ font: "600 12.5px/1.55 var(--sans)", color: "var(--ink)" }}>{contextPerson?.display_name ?? "Someone you follow"}</PersonLink> {ctx.text}</span>
            </span>
            {ctx.note && <div style={{ marginTop: 5, color: "var(--ink)", font: "400 13px/1.6 var(--sans)" }}>{ctx.note}</div>}
          </div>
        )}
        {/* One line: who · where · when · what kind · which topic, then follow and the menu. */}
        <div style={{ padding: "11px 14px 0", display: "flex", alignItems: "center", gap: 9 }}>
          <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={28} />
          <div style={{ flex: 1, minWidth: 0, font: "400 12.5px/1.55 var(--sans)", color: "var(--mute)" }}>
            <PersonLink id={p.author_id} style={{ font: "600 13.5px/1.55 var(--sans)", color: "var(--ink)" }}>{author?.display_name ?? "Someone"}</PersonLink>
            {place(author?.institution) && <> · <span title={author?.institution}>{place(author?.institution)}</span></>}
            {" · "}{timeAgo(p.created_at)}
            {" · "}<span title={spec?.label} style={{ fontWeight: 600, color: INTENT_COLOUR[p.intent] ?? "var(--mute)" }}>{KIND[p.intent] ?? spec?.label ?? p.intent}</span>
            {status && <span title={STATUS[status].hint} style={{ marginLeft: 6, padding: "1px 8px", borderRadius: 999, border: `1px solid ${STATUS[status].colour}`, color: STATUS[status].colour, font: "600 11px/1.5 var(--sans)", whiteSpace: "nowrap" }}>{STATUS[status].text}</span>}
            {isNew && <span className="sc-new-dot" title="New since your last visit" style={{ marginLeft: 6, display: "inline-block", width: 7, height: 7, borderRadius: 999, background: "var(--signal)", verticalAlign: "middle" }} />}
            {" · "}
            {p.group_id
              ? (group ? <Link href={`/groups/${group.id}`} style={{ color: "var(--ink)" }}>{group.name}</Link> : "group")
              : p.audience === "people" ? <span>only for the people asked</span>
              : <Link href={topicHref(p.room_id)} title={roomById(p.room_id)?.name} style={{ color: "var(--ink)" }}>#{p.room_id}</Link>}
          </div>
          {!own && follows === false && <FollowButton personId={p.author_id} following={false} inline />}
          <PostMenu postId={p.id} saved={extra?.saved ?? false} own={own} authorId={p.author_id} authorName={author?.display_name} room={p.group_id ? null : p.room_id} />
        </div>

        <div style={{ padding: "8px 14px 14px" }}>
          <Link href={`/posts/${p.id}`} className="sc-post-title" style={{ font: mono(15, 700, 1.45), color: "var(--ink)", textDecoration: "none" }}>{p.title}</Link>
          {p.body && <div style={{ marginTop: 8 }}><ExpandText long={p.body.length > 280 || p.body.split("\n").length > 4}><RichText body={p.body} style={{ font: "400 13.5px/1.75 var(--sans)" }} /></ExpandText></div>}
          <PostImages urls={images} title={p.title} />
          <LinkCard preview={p.link_preview} doi={p.link_preview ? null : doiOf(p.body)} />

          {card && (
            <Link href={`/methods/${card.id}`} className="sc-inset" style={{ display: "block", marginTop: 11, border: "1px solid var(--rule)", borderRadius: 12, background: "var(--bg)", padding: "10px 12px", color: "var(--ink)" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <Outcome value={card.outcome} />
                <span style={{ font: mono(10.5), color: "var(--mute)" }}>{card.code}</span>
              </div>
              <div style={{ font: mono(12.5, 500), marginTop: 6 }}>{card.title}</div>
            </Link>
          )}

          {p.intent === "feedback" && (
            <div className="sc-inset" style={{ marginTop: 11, border: "1px solid var(--info)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--info)", marginBottom: 6 }}>FEEDBACK WANTED</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", font: "400 12.5px/1.6 var(--sans)" }}>
                {(p.feedback_kinds ?? []).map((k: string) => <span key={k} style={{ padding: "2px 9px", borderRadius: 999, background: "color-mix(in srgb, var(--info) 10%, transparent)" }}>{feedbackLabel(k)}</span>)}
                {p.deadline && <span style={{ color: "var(--mute)" }}>by {p.deadline}</span>}
                {p.audience === "people" && <span style={{ color: "var(--mute)" }}>· only for the people asked</span>}
              </div>
              {(extra?.files ?? []).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                  {extra!.files.map((f) => (
                    <a key={f.id} href={`/api/post-files/${f.id}`} target="_blank" rel="noreferrer"
                      style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 10, border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink)", font: "500 12.5px/1.2 var(--sans)", textDecoration: "none" }}>
                      <span aria-hidden="true" style={{ font: mono(9, 700), color: "var(--err)" }}>{f.mime === "application/pdf" ? "PDF" : "IMG"}</span>{f.name}
                      <span style={{ color: "var(--mute)" }}>{fileSize(f.size_bytes)}</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}

          {p.intent === "collab" && (p.technique || p.offer || p.deadline) && (
            <div className="sc-inset" style={{ marginTop: 11, border: "1px solid var(--signal)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                <span style={{ font: mono(9.5, 700), letterSpacing: ".1em", color: "var(--signal-ink)" }}>WHAT IS NEEDED</span>
                <span style={{ marginLeft: "auto", padding: "2px 9px", borderRadius: 999, font: "600 11px/1.5 var(--sans)", color: (p.call_status ?? "open") === "open" ? "var(--ok)" : "var(--mute)", border: `1px solid ${(p.call_status ?? "open") === "open" ? "var(--ok)" : "var(--rule)"}` }}>
                  {(p.call_status ?? "open") === "open" ? "Open" : p.call_status === "filled" ? "Filled" : "Closed"}
                </span>
              </div>
              <div style={{ font: mono(11.5, 400, 1.8) }}>
                {p.technique && <div>technique · {p.technique}</div>}
                {p.organism && <div>system · {p.organism}</div>}
                {p.deadline && <div>by · {p.deadline}</div>}
                {p.offer && <div>offered back · {p.offer}</div>}
              </div>
            </div>
          )}
          {p.intent === "collab" && call && (
            <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <CallActions postId={p.id} authorId={p.author_id} authorName={author?.display_name} me={me} status={p.call_status} info={call} />
            </div>
          )}
        </div>
        {topReply && (
          <div style={{ margin: "0 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
            <ReplyBubble r={topReply} clamp />
            {(moreReplies ?? []).length > 0 && (
              // All replies, opened right here in the feed; the post page still has the full thread.
              <details className="sc-more-replies">
                <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", padding: "4px 2px", font: "600 12.5px/1.5 var(--sans)", color: "var(--mute)" }}>
                  <span className="sc-when-closed">View all {replies} replies</span><span className="sc-when-open">Hide replies</span>
                </summary>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
                  {moreReplies!.map((r, i) => <ReplyBubble key={i} r={r} />)}
                </div>
              </details>
            )}
          </div>
        )}
        {(reacted > 0 || (replies > 0 && !topReply) || reposts > 0) && (
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "7px 14px 0", font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>
            {reacted > 0 && <span>{reacted} {reacted === 1 ? "reaction" : "reactions"}</span>}
            <span style={{ marginLeft: "auto" }}>
              {[replies > 0 && !topReply && `${replies} ${replies === 1 ? "reply" : "replies"}`, reposts > 0 && `${reposts} ${reposts === 1 ? "repost" : "reposts"}`].filter(Boolean).join(" · ")}
            </span>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", padding: "8px 10px 8px 14px", borderTop: reacted || (replies && !topReply) || reposts || topReply ? 0 : "1px solid var(--rule)" }}>
          <Reactions kind="post" targetId={p.id} summary={reaction} own={own} path={path} />
          <PostActions postId={p.id} inGroup={!!p.group_id || p.audience === "people"} own={own} reposted={extra?.reposted ?? false} />
        </div>
        <InlineReply postId={p.id} />
      </Panel>
    </article>
  );
}

/** One reply in the feed: a soft bubble with who, when, and the text. */
function ReplyBubble({ r, clamp = false }: { r: { body: string; created_at: string; helped?: boolean; author?: Person }; clamp?: boolean }) {
  return (
    <div className="sc-inset" style={{ display: "flex", gap: 9, padding: "9px 11px", borderRadius: 14, background: "color-mix(in srgb, var(--ink) 4%, transparent)" }}>
      <Avatar name={r.author?.display_name ?? ""} url={r.author?.avatar_url} size={22} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ font: "600 12.5px/1.5 var(--sans)" }}>{r.author?.display_name ?? "Someone"}</span>
        <span style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}> · {timeAgo(r.created_at)}{r.helped ? " · helped the author" : ""}</span>
        <span style={clamp ? { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden", font: "400 13px/1.6 var(--sans)", marginTop: 2 }
          : { display: "block", font: "400 13px/1.6 var(--sans)", marginTop: 2, whiteSpace: "pre-wrap" }}>{r.body}</span>
      </span>
    </div>
  );
}
