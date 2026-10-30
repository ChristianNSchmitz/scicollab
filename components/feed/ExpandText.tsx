"use client";

import { useState, type ReactNode } from "react";

/** Long text shown to three lines, with "…more" to read the rest in place. */
export default function ExpandText({ long, children }: { long: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  if (!long) return <>{children}</>;
  return (
    <div>
      <div style={open ? undefined : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{children}</div>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{ border: 0, background: "none", padding: 0, marginTop: 4, color: "var(--mute)", font: "600 12.5px/1.4 var(--sans)", cursor: "pointer" }}>
        {open ? "less" : "…more"}
      </button>
    </div>
  );
}
