"use client";

import { useEffect, useRef } from "react";
import { SEEN_COOKIE, SEEN_DAYS, markSeen, parseSeen, serializeSeen } from "@/lib/seen";

/** How long the strip must be on screen before the post counts as seen. */
const DWELL_MS = 1500;

/**
 * The line above a post the feed holds at the top ("New reply on your post",
 * "Mentions you"). Once it has been on screen for a moment, with the tab in
 * front, the post counts as seen: the cookie records the activity it was held
 * for (lib/seen.ts), and the next time the feed is shown the post is back in
 * its place by date, unless something newer has happened on it.
 */
export default function PinnedStrip({ postId, at, reasons }: { postId: string; at: string; reasons: string[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    let timer: number | undefined;
    const record = () => {
      try {
        const current = parseSeen(document.cookie.split("; ").find((c) => c.startsWith(`${SEEN_COOKIE}=`))?.slice(SEEN_COOKIE.length + 1));
        const value = serializeSeen(markSeen(current, postId, at));
        document.cookie = `${SEEN_COOKIE}=${value}; path=/; max-age=${SEEN_DAYS * 86400}; SameSite=Lax`;
      } catch { /* cookies blocked: the post simply stays held */ }
    };
    const arm = () => { window.clearTimeout(timer); timer = window.setTimeout(() => { if (!document.hidden) record(); }, DWELL_MS); };
    let visible = false;
    const io = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      if (visible) arm(); else window.clearTimeout(timer);
    }, { threshold: 0.6 });
    io.observe(el);
    // Coming back to the tab with the strip in view starts the count again.
    const onVis = () => { if (!document.hidden && visible) arm(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { io.disconnect(); window.clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, [postId, at]);

  return (
    <div ref={ref} className="sc-pinned" style={{ padding: "7px 14px", display: "flex", alignItems: "center", gap: 8, font: "600 12px/1.4 var(--sans)", color: "var(--signal-ink)", background: "color-mix(in srgb, var(--signal) 9%, transparent)", borderBottom: "1px solid var(--rule)" }}>
      <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: 999, background: "var(--signal)" }} />
      {reasons.join(" · ")}
    </div>
  );
}
