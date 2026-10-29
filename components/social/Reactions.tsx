"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleReaction } from "@/app/actions/social";
import { REACTIONS, type ReactionKey, type ReactionSummary, type ReactionTarget } from "@/lib/social/reactions";

const pill = (on: boolean): React.CSSProperties => ({
  display: "inline-flex", alignItems: "center", gap: 6, height: 28, padding: "0 10px",
  border: `1px solid ${on ? "var(--ink)" : "var(--rule)"}`, background: on ? "var(--ink)" : "transparent",
  color: on ? "var(--bg)" : "var(--ink)", font: "500 11.5px/1 var(--mono)", cursor: "pointer",
});

/** The three reactions on a post or an answer, toggled with one click. */
export default function Reactions({ kind, targetId, summary, own, path }: {
  kind: ReactionTarget; targetId: string; summary?: ReactionSummary; own: boolean; path: string;
}) {
  const [counts, setCounts] = useState<Record<ReactionKey, number>>(summary?.counts ?? { useful: 0, seen: 0, can_help: 0 });
  const [mine, setMine] = useState<ReactionKey[]>(summary?.mine ?? []);
  const [, start] = useTransition();
  const router = useRouter();

  if (own) {
    // Your own post: no buttons, just what others said.
    const any = REACTIONS.filter((r) => counts[r.key] > 0);
    if (!any.length) return null;
    return (
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {any.map((r) => <span key={r.key} style={{ ...pill(false), cursor: "default" }}>{r.label} · {counts[r.key]}</span>)}
      </div>
    );
  }

  return (
    <div role="group" aria-label="Reactions" style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {REACTIONS.map((r) => {
        const on = mine.includes(r.key);
        return (
          <button
            key={r.key}
            type="button"
            aria-pressed={on}
            title={r.hint}
            style={pill(on)}
            onClick={() => {
              setMine(on ? mine.filter((k) => k !== r.key) : [...mine, r.key]);
              setCounts({ ...counts, [r.key]: counts[r.key] + (on ? -1 : 1) });
              start(async () => {
                const res = await toggleReaction(kind, targetId, r.key, path);
                if ("error" in res) router.refresh();
              });
            }}
          >
            {r.label}{counts[r.key] > 0 ? ` · ${counts[r.key]}` : ""}
          </button>
        );
      })}
    </div>
  );
}

/** Counts only, for lists such as the feed. */
export function ReactionCounts({ summary }: { summary?: ReactionSummary }) {
  if (!summary) return null;
  const parts = REACTIONS.filter((r) => summary.counts[r.key] > 0).map((r) => `${r.label.toLowerCase()} ${summary.counts[r.key]}`);
  return parts.length ? <span>{parts.join(" · ")}</span> : null;
}
