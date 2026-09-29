"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/* Top bar — board [ 003 ]: 56px, wordmark in a 200px well, search to 660px
   with its ⌘K hint, Create, notifications, avatar with a presence dot. */

export default function TopBar({ initials = "··", name = "" }: { initials?: string; name?: string }) {
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        router.push("/search");
      }
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    const stored = localStorage.getItem("sc-theme");
    const isDark = stored === "dark";
    setDark(isDark);
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.dataset.theme = next ? "dark" : "light";
    try { localStorage.setItem("sc-theme", next ? "dark" : "light"); } catch {}
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  const ghost: React.CSSProperties = {
    font: "500 11px/1 var(--mono)",
    padding: "8px 10px",
    border: "1px solid var(--rule)",
    background: "transparent",
    color: "var(--ink)",
    cursor: "pointer",
  };

  return (
    <header
      style={{
        height: "var(--top)",
        flex: "none",
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "0 16px",
        background: "var(--surface)",
        borderBottom: "1px solid var(--ink)",
      }}
    >
      <Link href="/home" style={{ display: "flex", alignItems: "flex-end", width: 200, textDecoration: "none", color: "var(--ink)" }}>
        <span style={{ position: "relative", font: "700 16px/1 var(--mono)", letterSpacing: "-.03em" }}>
          scicollab
          <span style={{ position: "absolute", left: 0, bottom: -5, width: 11, height: 3, background: "var(--signal)" }} />
        </span>
        <span style={{ font: "700 16px/1 var(--mono)", color: "var(--signal)" }}>/</span>
      </Link>

      <Link
        href="/search"
        style={{
          flex: 1, maxWidth: 660, display: "flex", alignItems: "center", gap: 10,
          height: 34, padding: "0 10px", border: "1px solid var(--rule)",
          background: "var(--bg)", textDecoration: "none",
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" strokeWidth="1.5" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
        </svg>
        <span style={{ font: "400 12px/1 var(--mono)", color: "var(--mute)", flex: 1 }}>
          Search people, projects, datasets, methods, discussions
        </span>
        <span style={{ font: "500 10px/1 var(--mono)", color: "var(--mute)", border: "1px solid var(--rule)", padding: "3px 5px" }}>⌘K</span>
      </Link>

      <Link href="/methods/new" style={{ ...ghost, borderColor: "var(--ink)", background: "var(--ink)", color: "var(--bg)", textDecoration: "none" }}>
        Create
      </Link>

      <button onClick={toggleTheme} style={ghost} aria-label="Toggle theme" title="Toggle theme">
        {dark ? "light" : "dark"}
      </button>

      <Link href="/notifications" style={{ position: "relative", display: "flex", alignItems: "center", padding: 6, color: "var(--ink)" }} aria-label="Notifications">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </Link>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenu((v) => !v)}
          style={{ ...ghost, display: "flex", alignItems: "center", gap: 8, padding: 4, border: "1px solid var(--rule)" }}
          aria-label="Account"
        >
          <span
            style={{
              position: "relative", width: 26, height: 26, border: "1px solid var(--ink)",
              display: "flex", alignItems: "center", justifyContent: "center",
              font: "500 10px/1 var(--mono)", background: "var(--bg)",
            }}
          >
            {initials}
            <span style={{ position: "absolute", right: -3, bottom: -3, width: 9, height: 9, background: "var(--ok)", border: "1px solid var(--surface)", borderRadius: "50%" }} />
          </span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--mute)" strokeWidth="1.8" strokeLinecap="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {menu && (
          <div
            onMouseLeave={() => setMenu(false)}
            style={{
              position: "absolute", right: 0, top: 40, width: 216, zIndex: 50,
              background: "var(--surface)", border: "1px solid var(--ink)",
            }}
          >
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--rule)" }}>
              <div style={{ font: "500 12px/1.3 var(--mono)" }}>{name || "Signed in"}</div>
            </div>
            <Link href="/you" onClick={() => setMenu(false)} style={{ display: "block", padding: "9px 12px", font: "400 12px/1 var(--mono)", color: "var(--ink)" }}>Your profile</Link>
            <Link href="/settings" onClick={() => setMenu(false)} style={{ display: "block", padding: "9px 12px", font: "400 12px/1 var(--mono)", color: "var(--ink)" }}>Settings</Link>
            <button onClick={signOut} style={{ width: "100%", textAlign: "left", padding: "9px 12px", font: "400 12px/1 var(--mono)", background: "transparent", border: 0, borderTop: "1px solid var(--rule)", color: "var(--err)", cursor: "pointer" }}>
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
