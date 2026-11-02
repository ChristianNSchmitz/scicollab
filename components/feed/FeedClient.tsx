"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { unmute } from "@/app/actions/feed";
import { REPLY_EVENT } from "@/components/feed/PostActions";
import type { MuteKind } from "@/lib/posts/mutes";
import { VISIT_COOKIE, SESSION_COOKIE } from "@/lib/posts/visit";

/**
 * The feed's small client-side helpers: remembering your last visit, the
 * "new posts" pill, loading more on scroll, dimming posts you opened,
 * keyboard moves, and the list of things you muted.
 */

// ── last visit ──────────────────────────────────────────────────────────────


function cookie(name: string) {
  return document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.slice(name.length + 1);
}

/**
 * On the first feed of a browser session, the previous visit becomes the
 * "new since" line for the whole session, so the line does not move while
 * you switch tabs; the visit time itself is updated every time.
 */
export function FeedVisit() {
  useEffect(() => {
    const now = new Date().toISOString();
    if (!cookie(SESSION_COOKIE)) document.cookie = `${SESSION_COOKIE}=${cookie(VISIT_COOKIE) ?? now}; path=/; samesite=lax`;
    document.cookie = `${VISIT_COOKIE}=${now}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return null;
}

// ── new posts while you read ────────────────────────────────────────────────

/** Asks every minute whether something new arrived, and offers to show it. */
export function FeedLive({ since, query }: { since: string | null; query: string }) {
  const [count, setCount] = useState(0);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    setCount(0);
    if (!since) return;
    let stop = false;
    const ask = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/feed/new?since=${encodeURIComponent(since)}&${query}`, { cache: "no-store" });
        if (r.ok && !stop) setCount((await r.json()).count ?? 0);
      } catch {}
    };
    const t = window.setInterval(ask, 60000);
    document.addEventListener("visibilitychange", ask);
    return () => { stop = true; window.clearInterval(t); document.removeEventListener("visibilitychange", ask); };
  }, [since, query]);
  if (!count) return null;
  return (
    <button type="button" disabled={pending} onClick={() => start(() => {
      router.refresh();
      setCount(0);
      document.getElementById("feed-posts")?.scrollIntoView({ behavior: "smooth", block: "start" });
    })}
      style={{ position: "sticky", top: 76, zIndex: 20, alignSelf: "center", padding: "8px 16px", borderRadius: 999, border: 0, background: "var(--signal)", color: "#fff", font: "600 13px/1 var(--sans)", boxShadow: "0 8px 24px rgba(31, 38, 60, .22)", cursor: "pointer" }}>
      ↑ {count} new post{count > 1 ? "s" : ""}
    </button>
  );
}

// ── more on scroll ──────────────────────────────────────────────────────────

/** Loads the next posts when you get near the end; the link stays as a fallback. */
export function AutoMore({ href }: { href: string }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  useEffect(() => {
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) return;
    let done = false;
    const io = new IntersectionObserver((es) => {
      if (done || !es.some((e) => e.isIntersecting)) return;
      done = true;
      start(() => router.replace(href, { scroll: false }));
    }, { rootMargin: "900px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [href, router]);
  return (
    <Link ref={ref} href={href} scroll={false} replace
      style={{ alignSelf: "center", padding: "9px 18px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", color: "var(--ink)", font: "600 13px/1 var(--sans)", textDecoration: "none" }}>
      {pending ? "Loading…" : "Show more"}
    </Link>
  );
}

// ── posts you opened, and keys ──────────────────────────────────────────────

const SEEN_KEY = "sc-seen";
function seen(): string[] {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]"); } catch { return []; }
}
function addSeen(id: string) {
  try { localStorage.setItem(SEEN_KEY, JSON.stringify([id, ...seen().filter((x) => x !== id)].slice(0, 500))); } catch {}
}

/** On a post page: remember that you opened it, so the feed can dim it. */
export function MarkSeen({ id }: { id: string }) {
  useEffect(() => { addSeen(id); }, [id]);
  return null;
}

/**
 * Dims the posts you already opened, and lets the keyboard move through the
 * feed: j next, k previous, r reply, o open.
 */
export function FeedKeys() {
  const router = useRouter();
  useEffect(() => {
    const posts = () => [...document.querySelectorAll<HTMLElement>("#feed-posts .sc-post")];
    const mark = () => {
      const s = new Set(seen());
      for (const a of posts()) a.classList.toggle("sc-seen", s.has(a.dataset.post ?? ""));
    };
    mark();
    const list = document.getElementById("feed-posts");
    const mo = list ? new MutationObserver(mark) : null;
    if (list) mo!.observe(list, { childList: true, subtree: false });

    const onClick = (e: MouseEvent) => {
      const a = (e.target as Element).closest("a[href^='/posts/']");
      const post = a?.closest<HTMLElement>(".sc-post");
      if (post?.dataset.post) addSeen(post.dataset.post);
    };
    let current = -1;
    const go = (i: number) => {
      const all = posts();
      if (!all.length) return;
      current = Math.max(0, Math.min(all.length - 1, i));
      all.forEach((a, n) => a.classList.toggle("sc-current", n === current));
      all[current].scrollIntoView({ behavior: "smooth", block: "start" });
    };
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.metaKey || e.ctrlKey || e.altKey || t.closest("input, textarea, select, [contenteditable='true']")) return;
      const all = posts();
      if (current < 0) {
        // Start from the first post on the screen.
        const top = all.findIndex((a) => a.getBoundingClientRect().bottom > 90);
        current = top < 0 ? -1 : top - 1;
      }
      if (e.key === "j") { e.preventDefault(); go(current + 1); }
      else if (e.key === "k") { e.preventDefault(); go(current - 1); }
      else if (e.key === "r" && all[current]) { e.preventDefault(); window.dispatchEvent(new CustomEvent(REPLY_EVENT, { detail: all[current].dataset.post })); }
      else if (e.key === "o" && all[current]) { e.preventDefault(); addSeen(all[current].dataset.post!); router.push(`/posts/${all[current].dataset.post}`); }
    };
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    return () => { mo?.disconnect(); document.removeEventListener("click", onClick); document.removeEventListener("keydown", onKey); };
  }, [router]);
  return null;
}

// ── muted ───────────────────────────────────────────────────────────────────

/** What you muted, each with Unmute; shown inside the feed's Filter. */
export function MutedList({ items }: { items: { kind: MuteKind; target: string; label: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [gone, setGone] = useState<string[]>([]);
  const left = items.filter((m) => !gone.includes(m.kind + m.target));
  if (!left.length) return null;
  return (
    <div>
      <div style={{ font: "600 12px/1 var(--sans)", color: "var(--mute)", marginBottom: 6 }}>Muted</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {left.map((m) => (
          <button key={m.kind + m.target} type="button" disabled={pending} title="Unmute"
            onClick={() => start(async () => { await unmute(m.kind, m.target); setGone((g) => [...g, m.kind + m.target]); router.refresh(); })}
            style={{ font: "500 12px/1 var(--sans)", padding: "7px 11px", borderRadius: 999, border: "1px dashed var(--rule)", background: "transparent", color: "var(--ink)", cursor: "pointer" }}>
            {m.label} <span aria-hidden="true" style={{ color: "var(--mute)" }}>×</span>
          </button>
        ))}
      </div>
    </div>
  );
}
