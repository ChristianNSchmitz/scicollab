import Link from "next/link";
import type { ReactNode } from "react";
import { mono } from "@/components/ui";
import SegIndicator from "@/components/SegIndicator";

/**
 * The one tab control used across the site: a segmented bar (feed, groups,
 * projects, You, calls). Optional `more` items fold into a "More" menu at the
 * end of the bar; it shows the active one's name when one of them is open.
 */
export type SegItem = { href: string; label: string; active: boolean; badge?: number; quiet?: boolean };

const badgeStyle = (quiet?: boolean) => ({
  marginLeft: 6, display: "inline-block", minWidth: 18, padding: "2px 6px", borderRadius: 999,
  background: quiet ? "var(--rule)" : "var(--signal)", color: quiet ? "var(--ink)" : "#fff", font: "700 10.5px/1.2 var(--sans)",
});

function Tab({ item }: { item: SegItem }) {
  return (
    // scroll={false}: switching tabs keeps the page where it is, it does not jump to the top or an anchor.
    <Link href={item.href} scroll={false} aria-current={item.active ? "page" : undefined}
      style={{ flex: "1 0 auto", textAlign: "center", padding: "9px 12px", font: mono(12, 600), textDecoration: "none", whiteSpace: "nowrap",
        color: item.active ? "var(--ink)" : "var(--mute)", borderBottom: item.active ? "2px solid var(--signal)" : "1px solid var(--rule)" }}>
      {item.label}
      {(item.badge ?? 0) > 0 && <span aria-label={`, ${item.badge} new or open`} style={badgeStyle(item.quiet)}>{item.badge}</span>}
    </Link>
  );
}

export default function SegTabs({ label, items, more, after, style }: {
  label: string; items: SegItem[]; more?: SegItem[]; after?: SegItem[]; style?: React.CSSProperties;
}) {
  const open = more?.find((m) => m.active);
  const moreBadge = (more ?? []).reduce((n, m) => n + (m.badge ?? 0), 0);
  return (
    <nav aria-label={label} className="sc-seg sc-seg-anim" style={{ display: "flex", gap: 0, margin: "0 0 16px", position: "relative", ...style }}>
      <SegIndicator id={label} activeKey={[...items, ...(more ?? []), ...(after ?? [])].find((i) => i.active)?.href ?? ""} />
      {items.map((it) => <Tab key={it.href} item={it} />)}
      {more && more.length > 0 && (
        <details style={{ flex: "1 0 auto", position: "relative", display: "flex" }}>
          <summary aria-current={open ? "page" : undefined}
            style={{ flex: 1, listStyle: "none", cursor: "pointer", textAlign: "center", padding: "9px 12px", font: mono(12, 600), whiteSpace: "nowrap", borderRadius: 9,
              color: open ? "var(--ink)" : "var(--mute)", background: open ? "var(--surface)" : "transparent", boxShadow: open ? "0 1px 3px rgba(0,0,0,.10)" : undefined,
              borderBottom: open ? "2px solid var(--signal)" : "1px solid var(--rule)" }}>
            {open ? open.label : "More"} ▾
            {!open && moreBadge > 0 && <span style={badgeStyle(true)}>{moreBadge}</span>}
          </summary>
          <div style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 30, minWidth: 180, padding: 6, borderRadius: 14, border: "1px solid var(--rule)",
            background: "color-mix(in srgb, var(--bg) 94%, transparent)", boxShadow: "0 12px 36px rgba(31, 38, 60, .16)",
            WebkitBackdropFilter: "blur(27px) saturate(218%)", backdropFilter: "blur(27px) saturate(218%)" }}>
            {more.map((m) => (
              <Link key={m.href} href={m.href} scroll={false} className="sc-menu-item" aria-current={m.active ? "page" : undefined}
                style={{ display: "flex", justifyContent: "space-between", padding: "9px 10px", borderRadius: 10, font: "500 13px/1.2 var(--sans)", textDecoration: "none",
                  color: "var(--ink)", background: m.active ? "color-mix(in srgb, var(--ink) 7%, transparent)" : undefined }}>
                {m.label}{(m.badge ?? 0) > 0 && <span style={badgeStyle(m.quiet)}>{m.badge}</span>}
              </Link>
            ))}
          </div>
        </details>
      )}
      {(after ?? []).map((it) => <Tab key={it.href} item={it} />)}
    </nav>
  );
}

/** A row of header buttons with an optional "···" menu holding the rarer actions. */
export function HeaderMenu({ children }: { children: ReactNode }) {
  return (
    <details style={{ position: "relative" }}>
      <summary aria-label="More actions" style={{ listStyle: "none", cursor: "pointer", height: 34, minWidth: 40, padding: "0 12px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "grid", placeItems: "center", font: "700 15px/1 var(--sans)", color: "var(--ink)" }}>···</summary>
      <div style={{ position: "absolute", right: 0, top: 40, zIndex: 40, minWidth: 220, padding: 6, borderRadius: 14, border: "1px solid var(--rule)",
        background: "color-mix(in srgb, var(--bg) 94%, transparent)", boxShadow: "0 12px 36px rgba(31, 38, 60, .16)", display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </details>
  );
}

/** A row inside HeaderMenu: link or button, same shape. */
export const menuRow = { display: "block", width: "100%", textAlign: "left" as const, padding: "9px 10px", borderRadius: 10, border: 0, background: "transparent",
  font: "500 13px/1.4 var(--sans)", color: "var(--ink)", textDecoration: "none", cursor: "pointer" };
