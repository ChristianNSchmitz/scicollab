"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type Step = { key: string; label: string; href: string; done: boolean };

/**
 * First steps for a new member, on top of the feed until they are done or
 * hidden: the things that make the network useful to them (a profile people
 * can recognise, a record that updates itself, people and groups to hear
 * from, a first post). Hiding is remembered in this browser only.
 */
export default function GettingStarted({ steps }: { steps: Step[] }) {
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try { setHidden(localStorage.getItem("sc-start-hidden") === "1"); } catch { setHidden(false); }
  }, []);
  const done = steps.filter((s) => s.done).length;
  if (hidden || done === steps.length) return null;
  return (
    <section aria-label="Getting started" className="sc-panel" style={{ background: "var(--surface)", border: "1px solid var(--rule)", padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <strong style={{ font: "600 14px/1.3 var(--sans)" }}>Get started</strong>
        <span style={{ font: "400 12.5px/1.3 var(--sans)", color: "var(--mute)" }}>{done} of {steps.length} done</span>
        <span style={{ flex: 1 }} />
        <button type="button" onClick={() => { setHidden(true); try { localStorage.setItem("sc-start-hidden", "1"); } catch {} }}
          style={{ background: "transparent", border: 0, font: "400 12px/1 var(--sans)", color: "var(--mute)", cursor: "pointer" }}>Hide</button>
      </div>
      <div role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={done} aria-label="Steps done"
        style={{ height: 4, background: "var(--rule)", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
        <div style={{ width: `${(done / steps.length) * 100}%`, height: "100%", background: "var(--signal)" }} />
      </div>
      <ol className="sc-start" style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", gap: 6, flexWrap: "wrap" }}>
        {steps.map((s) => (
          <li key={s.key}>
            {s.done ? (
              <span className="sc-chip" style={{ display: "inline-block", color: "var(--ok)", borderColor: "transparent" }}>✓ {s.label}</span>
            ) : (
              <Link href={s.href} className="sc-chip" style={{ display: "inline-block" }}>{s.label} →</Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
