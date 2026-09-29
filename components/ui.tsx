import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/* The house rules from board [ 001 ]: no gradients, no shadows, no rounded
   cards, no illustration. Elevation is a border plus a background step.
   Max three signal-coloured elements per screen. Dense by default. */

export const mono = (size: number, weight = 400, lh = 1) =>
  `${weight} ${size}px/${lh} var(--mono)`;

export function Page({ title, lede, actions, children }: {
  title: string; lede?: string; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <div style={{ padding: "24px 16px 64px" }}>
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
        <header style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--ink)" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ font: mono(19, 700, 1.2), margin: 0, letterSpacing: "-.02em" }}>{title}</h1>
            {lede && <p style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", margin: "7px 0 0", maxWidth: "72ch" }}>{lede}</p>}
          </div>
          {actions}
        </header>
        {children}
      </div>
    </div>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--rule)", ...style }}>
      {children}
    </div>
  );
}

export function PanelHead({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: mono(10, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)" }}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "34px 16px", textAlign: "center", font: "400 12.5px/1.7 var(--sans)", color: "var(--mute)" }}>
      {children}
    </div>
  );
}

/** Outcome is three states and a null result is never styled as an error. */
export function Outcome({ value }: { value: "success" | "partial" | "negative" | null }) {
  if (!value) return <Tag>ongoing</Tag>;
  const map = {
    success:  { label: "SUCCESS",         fg: "var(--ok)",     bd: "var(--ok)" },
    partial:  { label: "PARTIAL",         fg: "#8A6A00",       bd: "var(--flag)" },
    negative: { label: "NEGATIVE RESULT", fg: "var(--signal)", bd: "var(--signal)" },
  }[value];
  return (
    <span style={{ font: mono(10, 700), letterSpacing: ".08em", color: map.fg, border: `1px solid ${map.bd}`, padding: "3px 7px", whiteSpace: "nowrap" }}>
      {map.label}
    </span>
  );
}

/** Permanent chrome on any screen where a visibility decision could be made. */
export function Visibility({ value }: { value: "private" | "lab" | "public" }) {
  return (
    <span style={{ font: mono(10, 700), letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink)", background: "var(--bg)", border: "1px solid var(--ink)", padding: "3px 7px", whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span style={{ font: mono(10.5), color: "var(--mute)", border: "1px solid var(--rule)", padding: "3px 7px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export const btn: CSSProperties = {
  height: 34, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 7,
  border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)",
  font: mono(12, 500), cursor: "pointer", textDecoration: "none",
};

export const btnPrimary: CSSProperties = {
  ...btn, background: "var(--signal)", borderColor: "var(--signal)", color: "#fff",
};

export const field: CSSProperties = {
  width: "100%", padding: "9px 10px", border: "1px solid var(--rule)",
  background: "var(--bg)", font: "400 13px/1.5 var(--mono)", color: "var(--ink)",
};

export const fieldLabel: CSSProperties = {
  display: "block", font: mono(10, 700), letterSpacing: ".1em",
  textTransform: "uppercase", color: "var(--mute)", marginBottom: 6,
};

export function Row({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} style={{ display: "block", padding: "13px 14px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
      {children}
    </Link>
  );
}
