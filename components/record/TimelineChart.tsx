"use client";

import { useEffect, useRef, useState } from "react";

type Row = { title: string; unit: string; values: (number | null)[] };

/**
 * Running totals over time, one row per measure, sharing one time axis and
 * one hover readout. Each row has its own scale: citations and involvement
 * differ by an order of magnitude, and a shared axis would flatten one of
 * them. Square marks and ink, per board [ 001 ]; arrow keys move the readout.
 */
export default function TimelineChart({ labels, tips, rows }: { labels: string[]; tips: string[]; rows: Row[] }) {
  const box = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(120, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const n = labels.length;
  const L = 48, R = 14, rowH = 112, gap = 26, top = 22, axisH = 24;
  const H = top + rows.length * rowH + (rows.length - 1) * gap + axisH;
  const x = (i: number) => L + (n === 1 ? 0 : (i * (w - L - R)) / (n - 1));
  const at = hover ?? n - 1;

  // Labels thin out on narrow widths so they never collide.
  const every = Math.max(1, Math.ceil((n * 46) / Math.max(1, w - L - R)));

  function scale(values: (number | null)[]) {
    const v = values.filter((x): x is number => x !== null);
    if (!v.length) return null;
    let lo = Math.min(...v), hi = Math.max(...v);
    if (lo === hi) { lo = Math.max(0, lo - 1); hi = hi + 1; }
    const pad = (hi - lo) * 0.08;
    return { lo: Math.max(0, Math.floor(lo - pad)), hi: Math.ceil(hi + pad) };
  }

  function path(values: (number | null)[], y: (v: number) => number) {
    let d = "", pen = false;
    values.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  }

  const readout = rows.map((r) => {
    const v = r.values[at];
    return `${r.title} ${v === null ? "—" : v.toLocaleString("en-GB")}`;
  }).join("  ·  ");

  return (
    <div ref={box}>
      <div style={{ font: "500 11px/1.4 var(--mono)", minHeight: 16, marginBottom: 4 }} aria-live="polite">
        <span style={{ color: "var(--mute)" }}>{tips[at]}</span>{"  ·  "}{readout}
      </div>
      <svg
        width={w} height={H} role="img" tabIndex={0}
        aria-label={rows.map((r) => `${r.title}: ${r.values.map((v, i) => `${labels[i]} ${v ?? "none"}`).join(", ")}`).join(". ")}
        onMouseLeave={() => setHover(null)}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setHover(Math.max(0, at - 1));
          if (e.key === "ArrowRight") setHover(Math.min(n - 1, at + 1));
        }}
        style={{ display: "block", outline: "none" }}
      >
        {rows.map((r, ri) => {
          const y0 = top + ri * (rowH + gap);
          const s = scale(r.values);
          const y = (v: number) => (s ? y0 + rowH - ((v - s.lo) / (s.hi - s.lo)) * rowH : y0 + rowH);
          return (
            <g key={r.title}>
              <text x={0} y={y0 - 8} style={{ font: "700 10px var(--mono)", letterSpacing: ".1em", textTransform: "uppercase" }} fill="var(--mute)">
                {r.title}
              </text>
              <line x1={L} x2={w - R} y1={y0 + 0.5} y2={y0 + 0.5} stroke="var(--rule)" strokeDasharray="2 3" />
              <line x1={L} x2={w - R} y1={y0 + rowH / 2} y2={y0 + rowH / 2} stroke="var(--rule)" strokeDasharray="2 3" />
              <line x1={L} x2={w - R} y1={y0 + rowH + 0.5} y2={y0 + rowH + 0.5} stroke="var(--ink)" />
              {s ? (
                <>
                  <text x={L - 8} y={y0 + 4} textAnchor="end" style={{ font: "400 10px var(--mono)" }} fill="var(--mute)">{s.hi.toLocaleString("en-GB")}</text>
                  <text x={L - 8} y={y0 + rowH} textAnchor="end" style={{ font: "400 10px var(--mono)" }} fill="var(--mute)">{s.lo.toLocaleString("en-GB")}</text>
                  <path d={path(r.values, y)} fill="none" stroke="var(--ink)" strokeWidth={2} strokeLinejoin="round" />
                  {r.values.map((v, i) => v === null ? null : (
                    <circle key={i} cx={x(i)} cy={y(v)} r={i === at ? 5 : 3.5}
                            fill={i === n - 1 ? "var(--surface)" : "var(--ink)"} stroke={i === n - 1 ? "var(--ink)" : "var(--surface)"} strokeWidth={2} />
                  ))}
                </>
              ) : (
                <text x={(L + w - R) / 2} y={y0 + rowH / 2} textAnchor="middle" style={{ font: "400 11px var(--mono)" }} fill="var(--mute)">no data for this range</text>
              )}
            </g>
          );
        })}

        {/* crosshair spans every row */}
        <line x1={x(at)} x2={x(at)} y1={top} y2={H - axisH} stroke="var(--ink)" strokeOpacity={hover === null ? 0 : 0.35} />

        {labels.map((l, i) => (i % every === 0 || i === n - 1) && (
          <text key={i} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === n - 1 ? "end" : "middle"}
                style={{ font: "400 10px var(--mono)" }} fill={i === at && hover !== null ? "var(--ink)" : "var(--mute)"}>{l}</text>
        ))}

        {/* hit targets wider than the marks */}
        {labels.map((_, i) => {
          const half = n === 1 ? w : (w - L - R) / (n - 1) / 2;
          return <rect key={i} x={x(i) - half} y={0} width={half * 2} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />;
        })}
      </svg>

      <details style={{ marginTop: 8 }}>
        <summary style={{ font: "400 11px var(--mono)", color: "var(--mute)", cursor: "pointer" }}>Show as table</summary>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", font: "400 11px/1.6 var(--mono)", marginTop: 6 }}>
            <thead>
              <tr>
                <th style={cell}>Period</th>
                {rows.map((r) => <th key={r.title} style={{ ...cell, textAlign: "right" }}>{r.title}</th>)}
              </tr>
            </thead>
            <tbody>
              {labels.map((_, i) => (
                <tr key={i}>
                  <td style={cell}>{tips[i]}</td>
                  {rows.map((r) => <td key={r.title} style={{ ...cell, textAlign: "right" }}>{r.values[i] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

const cell: React.CSSProperties = { padding: "3px 12px 3px 0", borderBottom: "1px solid var(--rule)", textAlign: "left", fontWeight: 400 };
