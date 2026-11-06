import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/format";

export type BubbleReply = { id?: string; body: string; created_at: string; helped?: boolean; author?: { display_name?: string | null; avatar_url?: string | null } | null };

/** One reply in the feed: a soft bubble with who, when, and the text. */
export default function ReplyBubble({ r, clamp = false }: { r: BubbleReply; clamp?: boolean }) {
  return (
    <div className="sc-inset sc-bubble">
      <Avatar name={r.author?.display_name ?? ""} url={r.author?.avatar_url} size={22} />
      <span className="sc-bubble-text">
        <span className="sc-bubble-who">{r.author?.display_name ?? "Someone"}</span>
        <span className="sc-bubble-when"> · {timeAgo(r.created_at)}{r.helped ? " · helped the author" : ""}</span>
        <span className={clamp ? "sc-bubble-body sc-clamp3" : "sc-bubble-body"}>{r.body}</span>
      </span>
    </div>
  );
}
