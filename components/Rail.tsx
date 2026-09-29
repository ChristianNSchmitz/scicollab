"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

/* Rail items and geometry come from board [ 003 ] navigation shell:
   232px expanded, 56px collapsed, 36px rows, a 3px signal bar on the active
   item, and icons at 16px on a 24 viewBox with a 1.5 stroke. */

type Item = { href: string; label: string; d: string };

const PRIMARY: Item[] = [
  { href: "/home",      label: "Home",     d: "M3 9.8 12 3l9 6.8V20a1 1 0 0 1-1 1h-5v-6.5H9V21H4a1 1 0 0 1-1-1z" },
  { href: "/ask",       label: "Ask",      d: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
  { href: "/methods",   label: "Methods",  d: "M9 3v6l-5 9a2 2 0 0 0 1.7 3h12.6a2 2 0 0 0 1.7-3l-5-9V3M8 3h8M7.5 14h9" },
  { href: "/projects",  label: "Projects", d: "M3 7a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" },
  { href: "/data",      label: "Data",     d: "M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zm0 0v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" },
  { href: "/code",      label: "Code",     d: "m8 7-5 5 5 5m8-10 5 5-5 5" },
  { href: "/write",     label: "Write",    d: "M4 20h4l10-10a2.8 2.8 0 0 0-4-4L4 16zM13 6l4 4" },
  { href: "/network",   label: "Network",  d: "M12 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm14 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM10.5 7 6.5 16m7-9 4 9" },
  { href: "/you",       label: "You",      d: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0" },
];

const SECONDARY: Item[] = [
  { href: "/institution", label: "Institution", d: "M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" },
  { href: "/settings",    label: "Settings",    d: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 7.5 19.4l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3 14.5H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 7.5l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.5 3V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1.3z" },
  { href: "/help",        label: "Help",        d: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.4 9a2.6 2.6 0 0 1 5 .9c0 1.8-2.6 2.6-2.6 2.6M12 17h.01" },
];

function Icon({ d }: { d: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none" }}>
      <path d={d} />
    </svg>
  );
}

export default function Rail() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const width = open ? "var(--rail)" : "var(--rail-collapsed)";

  function row(it: Item) {
    const active = pathname === it.href || pathname.startsWith(it.href + "/");
    return (
      <Link
        key={it.href}
        href={it.href}
        title={open ? undefined : it.label}
        aria-current={active ? "page" : undefined}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 36,
          padding: "0 10px",
          textDecoration: "none",
          border: "1px solid transparent",
          background: active ? "var(--ink)" : "transparent",
          color: active ? "var(--bg)" : "var(--ink)",
          borderColor: active ? "var(--ink)" : "transparent",
        }}
      >
        {active && (
          <span style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--signal)" }} />
        )}
        <Icon d={it.d} />
        {open && <span style={{ font: "500 12px/1 var(--mono)" }}>{it.label}</span>}
      </Link>
    );
  }

  return (
    <nav
      aria-label="Primary"
      style={{
        width,
        flex: "none",
        background: "var(--surface)",
        borderRight: "1px solid var(--rule)",
        display: "flex",
        flexDirection: "column",
        padding: "12px 8px",
        overflow: "hidden",
        transition: "width .12s linear",
      }}
    >
      {PRIMARY.map(row)}

      <div style={{ flex: 1 }} />
      <div style={{ height: 1, background: "var(--rule)", margin: "8px 2px" }} />

      {SECONDARY.map(row)}

      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Collapse navigation" : "Expand navigation"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 36,
          padding: "0 10px",
          marginTop: 4,
          background: "transparent",
          border: "1px solid transparent",
          color: "var(--mute)",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             strokeWidth="1.5" strokeLinecap="round" style={{ flex: "none",
             transform: open ? "none" : "rotate(180deg)" }}>
          <path d="m14 7-5 5 5 5" />
        </svg>
        {open && <span style={{ font: "500 12px/1 var(--mono)" }}>Collapse</span>}
      </button>
    </nav>
  );
}
