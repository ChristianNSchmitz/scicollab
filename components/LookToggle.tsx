"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * Switches the prototype "glass" look on and off for this browser. It is a
 * preview of a possible redesign (app/globals.css, data-look="glass"), so
 * it is stored locally and nobody else sees the choice. ?look=glass or
 * ?look=classic in any address does the same.
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
      Glass look (prototype): {glass ? "on" : "off"}
    </button>
  );
}
