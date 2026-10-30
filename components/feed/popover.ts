import type { CSSProperties } from "react";

/** The floating panel used by the post menus: one rounded shape in both looks. */
export const popover: CSSProperties = {
  position: "absolute", zIndex: 40, minWidth: 220, padding: 6,
  // Nearly opaque: a menu over the feed must not let the feed read through.
  background: "color-mix(in srgb, var(--bg) 94%, transparent)", border: "1px solid var(--rule)", borderRadius: 14,
  boxShadow: "0 12px 36px rgba(31, 38, 60, .16), 0 2px 6px rgba(31, 38, 60, .06)",
  WebkitBackdropFilter: "blur(22px) saturate(198%)", backdropFilter: "blur(22px) saturate(198%)",
};

export const menuItem: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 10px", border: 0, borderRadius: 10,
  background: "transparent", color: "var(--ink)", font: "500 13px/1.3 var(--sans)", textAlign: "left", cursor: "pointer", textDecoration: "none",
};

/** The buttons along the bottom of a post. */
export const actionBtn: CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", border: 0, borderRadius: 999,
  background: "transparent", color: "var(--mute)", font: "600 12.5px/1 var(--sans)", cursor: "pointer", textDecoration: "none",
};
