"use client";

import { useState } from "react";
import { threadOf } from "@/app/actions/post-interactions";
import ReplyBubble, { type BubbleReply } from "@/components/feed/ReplyBubble";

/**
 * "View all replies" under a post in a feed. The thread is fetched when it
 * is opened, not sent with every post: most are never opened, and a long
 * thread made the whole feed heavier.
 */
export default function MoreReplies({ postId, total, shownId }: { postId: string; total: number; shownId?: string }) {
  const [replies, setReplies] = useState<BubbleReply[] | null>(null);
  const [state, setState] = useState<"" | "loading" | "error">("");
  const load = async () => {
    if (replies || state === "loading") return;
    setState("loading");
    const r = await threadOf(postId);
    if ("error" in r) { setState("error"); return; }
    setReplies(r.replies.filter((x) => x.id !== shownId));
    setState("");
  };
  return (
    <details className="sc-more-replies" onToggle={(e) => { if ((e.currentTarget as HTMLDetailsElement).open) void load(); }}>
      <summary onMouseEnter={() => void load()} style={{ listStyle: "none", cursor: "pointer", width: "fit-content", padding: "4px 2px", font: "600 12.5px/1.5 var(--sans)", color: "var(--mute)" }}>
        <span className="sc-when-closed">View all {total} replies</span><span className="sc-when-open">Hide replies</span>
      </summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
        {state === "loading" && !replies && <span style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)", padding: "2px" }}>Loading…</span>}
        {state === "error" && <span role="alert" style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--err)", padding: "2px" }}>The replies could not be loaded. <a href={`/posts/${postId}#replies`}>Open the post</a></span>}
        {(replies ?? []).map((r) => <ReplyBubble key={r.id} r={r} />)}
      </div>
    </details>
  );
}
