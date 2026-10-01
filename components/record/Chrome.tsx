import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { mono } from "@/components/ui";

export const WINDOWS = [8, 12, 26];

/** "ONLY ME" plus the policy, stated where the numbers are, and the window. */
export function PrivacyStrip({ children, weeks, hrefFor }: {
  children: ReactNode; weeks: number; hrefFor: (w: number) => string;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, padding: "10px 14px", marginBottom: 16, background: "var(--surface)", border: "1px solid var(--ink)" }}>
      <span style={{ font: mono(10, 700), letterSpacing: ".09em", border: "1px solid var(--ink)", padding: "3px 7px", whiteSpace: "nowrap" }}>ONLY ME</span>
      <span style={{ font: "400 12px/1.55 var(--sans)", color: "var(--ink)", flex: "1 1 320px" }}>{children}</span>
      <div style={{ display: "flex", border: "1px solid var(--rule)" }} role="group" aria-label="Time window">
        {WINDOWS.map((w) => (
          <Link key={w} href={hrefFor(w)} aria-current={w === weeks ? "true" : undefined}
                style={{ padding: "6px 10px", font: mono(11, 500), textDecoration: "none",
                         background: w === weeks ? "var(--ink)" : "transparent",
                         color: w === weeks ? "var(--bg)" : "var(--ink)" }}>
            {w} wk
          </Link>
        ))}
      </div>
    </div>
  );
}

/** Three columns at full width, two on a laptop split, one on a phone. */
export const tileGrid: CSSProperties = {
  display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 12, marginBottom: 16,
};

/** Two panels side by side that stack when there is no room. */
export function Pair({ wide, narrow }: { wide: ReactNode; narrow: ReactNode }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16, alignItems: "flex-start" }}>
      <div style={{ flex: "2 1 460px", minWidth: 0 }}>{wide}</div>
      <div style={{ flex: "1 1 280px", minWidth: 0 }}>{narrow}</div>
    </div>
  );
}

export const smallCaps: CSSProperties = {
  font: mono(10, 700), letterSpacing: ".1em", textTransform: "uppercase",
};
