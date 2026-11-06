import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import AdSlot from "@/components/AdSlot";

/* The classic house rules from board [ 001 ]: no gradients, no shadows, no
   rounded cards, no illustration; elevation is a border plus a background
   step. The default "glass" look (app/globals.css) softens these through
   class hooks (sc-panel, sc-badge, sc-page-head…) without changing the
   components, so both looks stay available. Max three signal-coloured
   elements per screen. Dense by default. */

/** Monospace text never goes below 11px: the boards drew labels at 9–10.5px,
 *  which is hard to read in a dense, uppercase, letter-spaced face. */
export const mono = (size: number, weight = 400, lh = 1) =>
  `${weight} ${size < 11 ? Math.min(11, size + 1.5) : size}px/${lh} var(--mono)`;

export function Page({ title, lede, actions, eyebrow, ad, children }: {
  title: string; lede?: string; actions?: ReactNode;
  /** A small line above the heading, e.g. the project a tab belongs to. */
  eyebrow?: ReactNode;
  /** Reserve room for an advertisement in a column on the right, as on the feed. Browse pages only. */
  ad?: boolean;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "24px 16px 64px" }}>
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
        <header className="sc-page-head" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start", gap: 16, marginBottom: 20, paddingBottom: 14, borderBottom: "1px solid var(--ink)" }}>
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            {eyebrow && <div style={{ font: "500 13px/1.5 var(--sans)", color: "var(--mute)", margin: "0 0 4px" }}>{eyebrow}</div>}
            <h1 className="sc-title" style={{ font: mono(19, 700, 1.2), margin: 0, letterSpacing: "-.02em" }}>{title}</h1>
            {lede && <p style={{ font: "400 13.5px/1.7 var(--sans)", color: "var(--mute)", margin: "7px 0 0", maxWidth: "72ch" }}>{lede}</p>}
          </div>
          {actions}
        </header>
        {ad ? (
          // As on the feed: the page on the left, the ad on the right, staying in view while the page scrolls.
          <div className="sc-ad-grid">
            <div style={{ minWidth: 0 }}>{children}</div>
            <div className="sc-ad-col"><AdSlot className="sc-ad-sticky" /></div>
          </div>
        ) : children}
      </div>
    </div>
  );
}

export function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="sc-panel" style={{ background: "var(--surface)", border: "1px solid var(--rule)", ...style }}>
      {children}
    </div>
  );
}

export function PanelHead({ children }: { children: ReactNode }) {
  return (
    <div className="sc-panel-head" style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: mono(10, 700), letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)" }}>
      {children}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "34px 16px", textAlign: "center", font: "400 13.5px/1.8 var(--sans)", color: "var(--mute)" }}>
      {children}
    </div>
  );
}

/** Outcome is three states and a null result is never styled as an error. */
export function Outcome({ value }: { value: "success" | "partial" | "negative" | null }) {
  if (!value) return <Tag>ongoing</Tag>;
  const map = {
    success:  { label: "SUCCESS",         fg: "var(--ok)",     bd: "var(--ok)" },
    partial:  { label: "PARTIAL",         fg: "var(--flag-ink)",       bd: "var(--flag)" },
    negative: { label: "NEGATIVE RESULT", fg: "var(--signal-ink)", bd: "var(--signal-ink)" },
  }[value];
  return (
    <span className="sc-badge" style={{ font: mono(10, 700), letterSpacing: ".08em", color: map.fg, border: `1px solid ${map.bd}`, padding: "3px 7px", whiteSpace: "nowrap" }}>
      {map.label}
    </span>
  );
}

/** Permanent chrome on any screen where a visibility decision could be made. */
export function Visibility({ value }: { value: "private" | "lab" | "public" }) {
  return (
    <span className="sc-badge" style={{ font: mono(10, 700), letterSpacing: ".09em", textTransform: "uppercase", color: "var(--ink)", background: "var(--bg)", border: "1px solid var(--ink)", padding: "3px 7px", whiteSpace: "nowrap" }}>
      {value}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="sc-badge" style={{ font: mono(10.5), color: "var(--mute)", border: "1px solid var(--rule)", padding: "3px 7px", whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

export const btn: CSSProperties = {
  height: 34, padding: "0 14px", display: "inline-flex", alignItems: "center", gap: 7,
  border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)",
  font: mono(12, 500), cursor: "pointer", textDecoration: "none",
  // Round in the glass look (--r-btn), square in the classic one.
  borderRadius: "var(--r-btn, 0)",
};

export const btnPrimary: CSSProperties = {
  ...btn, background: "var(--signal-fill)", borderColor: "var(--signal-fill)", color: "var(--on-signal)",
};

export const field: CSSProperties = {
  width: "100%", padding: "9px 10px", border: "1px solid var(--rule)",
  background: "var(--bg)", font: "400 13px/1.6 var(--mono)", color: "var(--ink)",
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

/** Shown when a write was refused by the rate limit (lib/ratelimit.ts). */
export function LimitNotice({ show }: { show?: string }) {
  if (!show) return null;
  return (
    <p role="alert" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--err)", color: "var(--err)", background: "var(--surface)" }}>
      That was not sent: you have reached the limit for now. Please wait a few minutes and try again.
    </p>
  );
}
