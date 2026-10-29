import Link from "next/link";
import type { Activity } from "@/lib/social/activity";
import Avatar from "@/components/Avatar";
import { mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

const KIND: Record<Activity["kind"], string> = {
  post: "post", answer: "answer", question: "question", card: "method", paper: "paper", reproduction: "reproduction", group: "group", fork: "fork",
};

/** A stream of what people did, each line linking to the thing itself. */
export default function ActivityList({ items, compact = false, empty }: { items: Activity[]; compact?: boolean; empty: string }) {
  if (!items.length) return <div style={{ padding: "12px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>{empty}</div>;
  return (
    <>
      {items.map((a, i) => {
        const external = a.href.startsWith("http");
        const body = (
          <>
            <span style={{ font: "400 13px/1.5 var(--sans)" }}>
              {!compact && a.actor && <strong style={{ fontWeight: 600 }}>{a.actor.display_name} </strong>}
              <span style={{ color: "var(--mute)" }}>{a.text}</span>{" "}
              <span>{a.title}</span>
            </span>
            <span style={{ display: "block", font: mono(10.5), color: "var(--mute)", marginTop: 2 }}>{KIND[a.kind]} · {timeAgo(a.at)}</span>
          </>
        );
        const style = { display: "flex", gap: 10, padding: "10px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" } as const;
        return (
          <div key={i} style={{ position: "relative" }}>
            {external ? (
              <a href={a.href} target="_blank" rel="noreferrer" style={style}>
                {!compact && a.actor && <Avatar name={a.actor.display_name} url={a.actor.avatar_url} size={26} />}
                <span style={{ flex: 1, minWidth: 0 }}>{body}</span>
              </a>
            ) : (
              <Link href={a.href} style={style}>
                {!compact && a.actor && <Avatar name={a.actor.display_name} url={a.actor.avatar_url} size={26} />}
                <span style={{ flex: 1, minWidth: 0 }}>{body}</span>
              </Link>
            )}
          </div>
        );
      })}
    </>
  );
}
