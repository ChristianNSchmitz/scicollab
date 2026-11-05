"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { isPageNavigation, navigationFinished, LOADER_DELAY_MS, VEIL_DELAY_MS } from "@/lib/nav-loader";

/** If the address never changes (a click that turned out not to navigate), stop waiting. */
const GIVE_UP_MS = 20_000;

type Box = { top: number; left: number; width: number };

/**
 * The loading screen for a slow page change. Quick changes never show it: the
 * old page simply stays until the new one is there (there is no placeholder
 * page in between: swapping one in and out again looked like a flicker). The
 * pointer turns to the "busy" cursor at once; if the page is still not there a
 * full second after the click (LOADER_DELAY_MS) a thin bar starts moving along
 * the top of the page, and only VEIL_DELAY_MS later is the page dimmed under a
 * spinner. So a page that arrives just after the second is never covered for a
 * split second, which is what a loading screen that appears and vanishes at
 * once looks like.
 *
 * It covers the page area only, so the top bar, the side navigation and the chat
 * stay usable, and it lets clicks through: choosing somewhere else while waiting
 * simply starts over. It covers moving between tabs or filters of the same page
 * as well as other pages.
 *
 * Which clicks count, and when a change is over, is decided in lib/nav-loader.ts.
 */
export default function NavLoader() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const here = search ? `${pathname}?${search}` : pathname;
  const [box, setBox] = useState<Box | null>(null);
  const timers = useRef<{ show?: number; giveUp?: number; watch?: number }>({});
  const current = useRef(here);
  const startedAt = useRef<string | null>(null);

  const stop = () => {
    window.clearTimeout(timers.current.show);
    window.clearTimeout(timers.current.giveUp);
    window.clearInterval(timers.current.watch);
    timers.current = {};
    startedAt.current = null;
    document.documentElement.removeAttribute("data-navigating");
    setBox(null);
  };
  const where = () => location.pathname + location.search;
  const checkFinished = () => {
    if (startedAt.current === null) return;
    if (navigationFinished({ startedAt: startedAt.current, now: where() })) stop();
  };

  // The address changed: the new page is there.
  useEffect(() => { current.current = here; checkFinished(); }, [here]);

  useEffect(() => {
    const start = () => {
      window.clearTimeout(timers.current.show);
      window.clearTimeout(timers.current.giveUp);
      window.clearInterval(timers.current.watch);
      startedAt.current = where();
      document.documentElement.setAttribute("data-navigating", "");
      // The address is also checked on a timer, in case the change lands between renders.
      timers.current.watch = window.setInterval(checkFinished, 150);
      timers.current.show = window.setTimeout(() => {
        const page = document.querySelector("main.sc-main")?.getBoundingClientRect();
        const bar = document.querySelector(".sc-top")?.getBoundingClientRect();
        setBox({ top: Math.max(0, bar?.bottom ?? 0), left: page?.left ?? 0, width: page?.width ?? window.innerWidth });
      }, LOADER_DELAY_MS);
      timers.current.giveUp = window.setTimeout(stop, GIVE_UP_MS);
    };

    const onClick = (e: MouseEvent) => {
      if (e.button !== 0) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      const modified = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
      if (isPageNavigation({ href: a.href, base: location.href, target: a.target, download: a.hasAttribute("download"), modified })) start();
    };

    // A form that reads (search, filters) goes to a page; one that writes (a server action) stays where it is.
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement | null;
      if (!form || (form.method || "get").toLowerCase() !== "get") return;
      try {
        const to = new URL(form.action, location.href);
        for (const [k, v] of new FormData(form)) if (typeof v === "string") to.searchParams.append(k, v);
        if (isPageNavigation({ href: to.toString(), base: location.href, target: form.target })) start();
      } catch { /* not a form that goes anywhere */ }
    };

    // Back and forward; a change of fragment alone also fires this, and goes nowhere.
    const onPop = () => { if (location.pathname + location.search !== current.current) start(); };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("popstate", onPop);
      window.clearTimeout(timers.current.show);
      window.clearTimeout(timers.current.giveUp);
      window.clearInterval(timers.current.watch);
    };
  }, []);

  if (!box) return null;
  return (
    <div data-nav-loader role="status" aria-live="polite" className="sc-navload"
      style={{ position: "fixed", top: box.top, left: box.left, width: box.width, bottom: 0, zIndex: 25 }}>
      <div className="sc-navload-bar" aria-hidden="true" />
      <div className="sc-navload-veil" style={{ animationDelay: `${VEIL_DELAY_MS}ms` }}>
        <div className="sc-navload-card">
          <span className="sc-navload-ring" aria-hidden="true" />
          <span className="sc-navload-text">Loading…</span>
        </div>
      </div>
    </div>
  );
}
