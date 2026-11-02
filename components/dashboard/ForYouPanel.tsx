import Link from "next/link";
import { Panel, PanelHead, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";
import type { ForYou } from "@/lib/social/for-you";

/** "Where your expertise is wanted": feedback asked of you, and open questions that match what you know. */
export default function ForYouPanel({ data, names }: { data: ForYou; names: Map<string, string> }) {
  if (!data.feedback.length && !data.questions.length) return null;
  const row = { display: "flex", gap: 10, alignItems: "baseline", padding: "9px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" } as const;
  const kind = { flex: "none", font: mono(9.5, 700), letterSpacing: ".08em", padding: "3px 8px", borderRadius: 999 } as const;
  return (
    <Panel style={{ maxWidth: 820, margin: "14px auto 0", borderColor: "var(--info)" }}>
      <PanelHead>Where your expertise is wanted · {data.feedback.length + data.questions.length}</PanelHead>
      {data.feedback.map((f) => (
        <Link key={f.id} href={`/posts/${f.id}`} style={row}>
          <span style={{ ...kind, color: "var(--info)", background: "color-mix(in srgb, var(--info) 10%, transparent)" }}>FEEDBACK</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ font: "600 13.5px/1.4 var(--sans)" }}>{f.title}</span>
            <span style={{ display: "block", font: "400 12px/1.4 var(--sans)", color: "var(--mute)" }}>{names.get(f.author_id) ?? "Someone"} asked you{f.deadline ? `, by ${f.deadline}` : ""}</span>
          </span>
        </Link>
      ))}
      {data.questions.map((q) => (
        <Link key={q.id} href={`/questions/${q.id}`} style={row}>
          <span style={{ ...kind, color: "var(--signal-ink)", background: "color-mix(in srgb, var(--signal) 10%, transparent)" }}>QUESTION</span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ font: "600 13.5px/1.4 var(--sans)" }}>{q.title}</span>
            <span style={{ display: "block", font: "400 12px/1.4 var(--sans)", color: "var(--mute)" }}>No answer yet · matches “{q.match}” · {timeAgo(q.created_at)}</span>
          </span>
        </Link>
      ))}
    </Panel>
  );
}
