import Link from "next/link";
import Avatar from "@/components/Avatar";
import PersonLink from "@/components/social/PersonLink";
import CallActions, { type CallInfo } from "@/components/feed/CallActions";
import { Panel, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import { roomById } from "@/lib/taxonomy";
import type { Person } from "@/lib/people";

/**
 * One call for collaborators in the Calls tab of the feed: who is asking, what
 * is needed (technique, system, deadline, what is offered back), its status,
 * and the way to answer it.
 */
export default function CallCard({ c, author, me, info }: { c: any; author?: Person; me: string; info: CallInfo }) {
  const open = (c.call_status ?? "open") === "open";
  return (
    <article id={`post-${c.id}`} style={{ scrollMarginTop: 72 }}>
      <Panel>
        <div style={{ padding: "12px 14px", display: "flex", gap: 10, alignItems: "flex-start", flexWrap: "wrap" }}>
          <Avatar name={author?.display_name ?? ""} url={author?.avatar_url} size={30} />
          <div style={{ flex: "1 1 300px", minWidth: 0 }}>
            <Link href={`/posts/${c.id}`} style={{ font: "650 15px/1.45 var(--sans)", color: "var(--ink)", textDecoration: "none" }}>{c.title}</Link>
            <div style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", marginTop: 2 }}>
              <PersonLink id={c.author_id}>{author?.display_name ?? "Someone"}</PersonLink>{author?.institution ? ` · ${author.institution}` : ""} · {timeAgo(c.created_at)}{roomById(c.room_id) ? ` · #${c.room_id}` : ""}
            </div>
          </div>
          <span style={{ padding: "3px 10px", borderRadius: 999, font: "600 11.5px/1.5 var(--sans)", color: open ? "var(--ok)" : "var(--mute)", border: `1px solid ${open ? "var(--ok)" : "var(--rule)"}` }}>
            {open ? "Open" : c.call_status === "filled" ? "Filled" : "Closed"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, padding: "0 14px 12px" }}>
          {[["Technique", c.technique], ["System", c.organism], ["By", c.deadline], ["Offered back", c.offer]].filter(([, v]) => v).map(([k, v]) => (
            <div key={k as string} className="sc-inset" style={{ padding: "8px 10px", borderRadius: 12, background: "var(--bg)", border: "1px solid var(--rule)" }}>
              <div style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: "var(--mute)" }}>{String(k).toUpperCase()}</div>
              <div style={{ font: "500 13px/1.5 var(--sans)", marginTop: 3 }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <CallActions postId={c.id} authorId={c.author_id} authorName={author?.display_name} me={me} status={c.call_status} info={info} />
          <Link href={`/posts/${c.id}`} style={{ marginLeft: "auto", font: "500 12.5px/1 var(--sans)", color: "var(--mute)", textDecoration: "none" }}>Open the call →</Link>
        </div>
      </Panel>
    </article>
  );
}
