"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { PRIMARY, SECONDARY, Icon } from "@/components/Rail";
import LookToggle from "@/components/LookToggle";

/**
 * Phone navigation: four destinations in reach of a thumb, and "More" for
 * the rest, including Messages and the theme switch the top bar drops on a
 * small screen. Hidden above 760px by CSS (globals.css), where the rail is.
 */
const TABS = ["/home", "/groups", "/projects", "/you"];
const MESSAGES = { href: "/messages", label: "Messages", d: "M4 5h16v11H8l-4 4zM8 9h8M8 12h5" };
const NOTIFICATIONS = { href: "/notifications", label: "Notifications", d: "M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0" };

export default function TabBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    setDark(document.documentElement.dataset.theme === "dark");
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const tabs = TABS.map((h) => PRIMARY.find((p) => p.href === h)!);
  const more = [
    ...PRIMARY.filter((p) => !TABS.includes(p.href)).slice(0, 1),   // Methods first
    MESSAGES,
    ...PRIMARY.filter((p) => !TABS.includes(p.href)).slice(1),
    NOTIFICATIONS,
    ...SECONDARY,
  ];
  const moreActive = more.some((m) => active(m.href));

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("sc-theme", next ? "dark" : "light"); } catch {}
  }

  const tab = (href: string, label: string, d: string, on: boolean, onClick?: () => void) => {
    const inner = (
      <>
        {on && <span className="sc-tab-on" style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 3, background: "var(--signal)" }} />}
        <Icon d={d} />
        <span className="sc-tab-label" style={{ font: "500 11px/1 var(--mono)" }}>{label}</span>
      </>
    );
    const style: React.CSSProperties = {
      position: "relative", flex: 1, minWidth: 0, height: 56, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 5, textDecoration: "none",
      color: on ? "var(--ink)" : "var(--mute)", background: "transparent", border: 0, cursor: "pointer",
    };
    return onClick
      ? <button key={label} type="button" onClick={onClick} style={style} aria-expanded={open} aria-haspopup="dialog">{inner}</button>
      : <Link key={label} href={href} style={style} aria-current={on ? "page" : undefined}>{inner}</Link>;
  };

  return (
    <>
      <nav className="sc-tabbar" aria-label="Primary">
        {tabs.map((t) => tab(t.href, t.label, t.d, active(t.href)))}
        {tab("#", "More", "M4 6h16M4 12h16M4 18h16", open || moreActive, () => setOpen((v) => !v))}
      </nav>

      {open && (
        <div className="sc-sheet" role="dialog" aria-modal="true" aria-label="More destinations">
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, bottom: "calc(56px + env(safe-area-inset-bottom))", zIndex: 41, background: "rgba(13,13,13,.35)" }} />
          {/* A rounded sheet with rounded tiles: the same shapes as the rest of the site. */}
          <div style={{
            position: "fixed", left: 8, right: 8, bottom: "calc(64px + env(safe-area-inset-bottom))", zIndex: 42,
            maxHeight: "75vh", overflowY: "auto", padding: 12, borderRadius: 24,
            background: "color-mix(in srgb, var(--bg) 94%, transparent)", border: "1px solid var(--rule)",
            boxShadow: "0 18px 48px rgba(31, 38, 60, .22)",
            WebkitBackdropFilter: "blur(27px) saturate(218%)", backdropFilter: "blur(27px) saturate(218%)",
          }}>
            <div style={{ display: "flex", alignItems: "center", padding: "2px 4px 10px" }}>
              <span style={{ font: "700 15px/1 var(--sans)", color: "var(--ink)", flex: 1 }}>More</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close"
                style={{ height: 30, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", font: "600 12.5px/1 var(--sans)", color: "var(--ink)", cursor: "pointer" }}>Close</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {more.map((m) => (
                <Link key={m.href} href={m.href} aria-current={active(m.href) ? "page" : undefined}
                      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, padding: "14px 6px", borderRadius: 16,
                               border: "1px solid var(--rule)",
                               background: active(m.href) ? "var(--ink)" : "var(--surface)", color: active(m.href) ? "var(--bg)" : "var(--ink)",
                               textDecoration: "none", font: "500 12px/1.2 var(--sans)", textAlign: "center" }}>
                  <Icon d={m.d} />{m.label}
                </Link>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" onClick={toggleTheme}
                      style={{ flex: 1, height: 40, borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", font: "600 13px/1 var(--sans)", color: "var(--ink)", cursor: "pointer" }}>
                {dark ? "Light mode" : "Dark mode"}
              </button>
              <LookToggle style={{ flex: 1, height: 40, borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", font: "600 13px/1 var(--sans)", color: "var(--ink)", cursor: "pointer" }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
