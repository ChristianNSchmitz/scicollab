"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Switches between the glass look (the default, app/globals.css,
 * data-look="glass") and the classic square, monospace look, for this
 * browser only. ?look=glass or ?look=classic in any address does the same.
 */
export default function LookToggle({ style }: { style?: CSSProperties }) {
  const [glass, setGlass] = useState(false);
  useEffect(() => setGlass(document.documentElement.dataset.look === "glass"), []);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={glass}
      onClick={() => {
        const next = !glass;
        setGlass(next);
        if (next) document.documentElement.dataset.look = "glass";
        else delete document.documentElement.dataset.look;
        try { localStorage.setItem("sc-look", next ? "glass" : "classic"); } catch {}
      }}
      style={style}
    >
      {glass ? "Switch to classic look" : "Switch to glass look"}
    </button>
  );
}
