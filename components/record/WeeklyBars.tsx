"use client";

import { useState } from "react";

/**
 * One axis, one chart, one scale — the fix for a combined chart where reads
 * flatten every other measure against the baseline. Square marks and ink, per
 * board [ 001 ]; the current week is still filling, so it is drawn in mute.
 */
export default function WeeklyBars({ values, weekStarts, unit, max: sharedMax }: {
  values: number[]; weekStarts: string[]; unit: string;
  /** Pass the same max to two charts to put them on one scale on purpose. */
  max?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 300, H = 56, gap = 2;
  const max = Math.max(1, sharedMax ?? 0, ...values);
  const bw = (W - gap * (values.length - 1)) / values.length;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const last = values.length - 1;

  const empty = values.every((v) => v === 0);
  const caption = hover === null
    ? `${fmt(weekStarts[0])} – this week · ${empty ? "nothing in this window" : `max ${max} ${unit}/week`}`
    : `Week of ${fmt(weekStarts[hover])}${hover === last ? " (so far)" : ""} · ${values[hover]} ${unit}`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H + 1}`} width="100%" height={H + 1}
        preserveAspectRatio="none" role="img"
        aria-label={`Weekly ${unit}, oldest to newest: ${values.join(", ")}`}
        onMouseLeave={() => setHover(null)}
        style={{ display: "block", overflow: "visible" }}
      >
        <line x1={0} x2={W} y1={0.5} y2={0.5} stroke="var(--rule)" strokeDasharray="2 3" />
        {values.map((v, i) => {
          const h = v === 0 ? 0 : Math.max(3, (v / max) * (H - 4));
          const x = i * (bw + gap);
          return (
            <g key={i} onMouseEnter={() => setHover(i)}>
              <rect x={x} y={0} width={bw} height={H} fill={hover === i ? "var(--bg)" : "transparent"} />
              <rect x={x} y={H - h} width={bw} height={h}
                    fill={i === last ? "var(--mute)" : "var(--ink)"}
                    opacity={hover === null || hover === i ? 1 : 0.35} />
            </g>
          );
        })}
        <line x1={0} x2={W} y1={H + 0.5} y2={H + 0.5} stroke="var(--ink)" />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, font: "400 10px/1.3 var(--mono)", color: "var(--mute)" }}>
        <span>{caption}</span>
      </div>
    </div>
  );
}
