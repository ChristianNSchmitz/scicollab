"use client";

import { useEffect } from "react";

/**
 * Closes open dropdowns built from <details>: the feed's Filter, "More" in
 * a tab bar, a header's ··· menu. A click anywhere outside one, a click on a
 * link inside it, or Escape closes it. A <details> counts as a dropdown when
 * what it opens floats over the page (position absolute or fixed); inline
 * ones, such as a form that unfolds, are left alone so nothing typed is lost.
 */
export default function DropdownCloser() {
  useEffect(() => {
    const floating = (d: HTMLDetailsElement) =>
      [...d.children].some((c) => c.tagName !== "SUMMARY" && ["absolute", "fixed"].includes(getComputedStyle(c).position));
    const openDropdowns = () => [...document.querySelectorAll<HTMLDetailsElement>("details[open]")].filter(floating);

    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      for (const d of openDropdowns()) if (!d.contains(t)) d.open = false;
    };
    const onClick = (e: MouseEvent) => {
      // A choice made inside the menu: close it once the link has been followed.
      const a = (e.target as Element).closest("a[href]");
      const d = a?.closest<HTMLDetailsElement>("details[open]");
      // data-keep-open (the feed's Filter): several choices in a row, so it stays open.
      if (d && floating(d) && !d.hasAttribute("data-keep-open")) window.setTimeout(() => { d.open = false; }, 0);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const open = openDropdowns();
      for (const d of open) d.open = false;
      open[0]?.querySelector("summary")?.focus();
    };
    // Only one dropdown open at a time.
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (d.tagName !== "DETAILS" || !d.open || !floating(d)) return;
      for (const o of openDropdowns()) if (o !== d && !o.contains(d)) o.open = false;
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    document.addEventListener("toggle", onToggle, true);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("toggle", onToggle, true);
    };
  }, []);
  return null;
}
