"use client";

import { useLayoutEffect, useRef } from "react";

// Where the bar sat on screen when a tab was clicked, so the next page can put
// it back on the same spot whatever the browser did to the scroll position.
let pinned: { id: string; top: number; until: number } | null = null;

function holdPlace(id: string, nav: HTMLElement) {
  const p = pinned;
  if (!p || p.id !== id || Date.now() > p.until) return;
  let stop = false;
  const quit = () => { stop = true; };
  // A scroll by the reader ends the hold at once.
  const opts = { passive: true, once: true } as const;
  window.addEventListener("wheel", quit, opts);
  window.addEventListener("touchstart", quit, opts);
  window.addEventListener("keydown", quit, { once: true });
  const end = Date.now() + 700;
  const fix = () => {
    if (stop || !nav.isConnected) return;
    const d = nav.getBoundingClientRect().top - p.top;
    if (Math.abs(d) >= 1) window.scrollBy(0, d);
    if (Date.now() < end) requestAnimationFrame(fix);
    else { pinned = null; window.removeEventListener("wheel", quit); window.removeEventListener("touchstart", quit); window.removeEventListener("keydown", quit); }
  };
  fix();
}

/**
 * The sliding highlight behind the active tab of a SegTabs bar. On a click it
 * moves at once to the tab clicked, before the next page has loaded; between
 * pages it remembers where it was (per bar), so it slides from the old tab to
 * the new one instead of jumping. Without JavaScript the active tab keeps its
 * own highlight, so nothing depends on this.
 */
export default function SegIndicator({ id, activeKey }: { id: string; activeKey: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const ind = ref.current;
    const nav = ind?.parentElement;
    if (!ind || !nav) return;
    const storeKey = `sc-seg:${id}`;
    const geom = (el: Element) => {
      const n = nav.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: r.left - n.left + nav.scrollLeft, y: r.top - n.top, w: r.width, h: r.height };
    };
    const put = (g: { x: number; y: number; w: number; h: number }, animate: boolean) => {
      ind.style.transition = animate ? "" : "none";
      ind.style.transform = `translate(${g.x}px, ${g.y}px)`;
      ind.style.width = `${g.w}px`;
      ind.style.height = `${g.h}px`;
      ind.style.opacity = "1";
      try { sessionStorage.setItem(storeKey, JSON.stringify(g)); } catch {}
    };
    const activeEl = () => nav.querySelector(':scope > a[aria-current="page"], :scope > details > summary[aria-current="page"]');

    const target = activeEl();
    if (!target) { ind.style.opacity = "0"; nav.removeAttribute("data-ind"); return; }
    // Start where the highlight was on the previous page, then slide.
    let from: { x: number; y: number; w: number; h: number } | null = null;
    try { from = JSON.parse(sessionStorage.getItem(storeKey) ?? "null"); } catch {}
    const to = geom(target);
    if (from && (from.x !== to.x || from.w !== to.w)) {
      put(from, false);
      void ind.offsetWidth;                 // apply the start position before animating
      put(to, true);
    } else put(to, false);
    nav.setAttribute("data-ind", "on");
    holdPlace(id, nav);

    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a");
      if (!link || !nav.contains(link)) return;
      // A link inside "More" lands on the More tab itself.
      const tab = link.parentElement === nav ? link : link.closest("details")?.querySelector("summary");
      if (!tab) return;
      const now = activeEl();
      const g = geom(tab);
      // Which way the content slides: towards the tab you chose.
      if (now && now !== tab) {
        document.documentElement.dataset.slide = g.x > geom(now).x ? "right" : "left";
        window.setTimeout(() => { delete document.documentElement.dataset.slide; }, 1200);
      }
      put(g, true);
      pinned = { id, top: nav.getBoundingClientRect().top, until: Date.now() + 15000 };
    };
    const onResize = () => { const a = activeEl(); if (a) put(geom(a), false); };
    nav.addEventListener("click", onClick);
    const ro = new ResizeObserver(onResize);
    ro.observe(nav);
    return () => { nav.removeEventListener("click", onClick); ro.disconnect(); };
  }, [id, activeKey]);

  return <span ref={ref} aria-hidden="true" className="sc-seg-ind" />;
}
