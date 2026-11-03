"use client";

import { useEffect, useState } from "react";

/**
 * A time shown in the reader's own time zone. The server does not know it,
 * so the first render shows UTC and the browser corrects it at once.
 */
export default function LocalTime({ iso, end, withDate = true }: { iso: string; end?: string | null; withDate?: boolean }) {
  const fmt = (d: Date, date: boolean, tz?: string) => d.toLocaleString("en-GB", { ...(date ? { weekday: "short", day: "numeric", month: "short", year: "numeric" } : {}), hour: "2-digit", minute: "2-digit", ...(tz ? { timeZone: tz } : {}) });
  const render = (tz?: string) => {
    const a = new Date(iso);
    const b = end ? new Date(end) : null;
    const sameDay = b && a.toDateString() === b.toDateString();
    return `${fmt(a, withDate, tz)}${b ? ` – ${fmt(b, !sameDay, tz)}` : ""}${tz ? " UTC" : ""}`;
  };
  const [text, setText] = useState(() => render("UTC"));
  useEffect(() => setText(render()), [iso, end]); // eslint-disable-line react-hooks/exhaustive-deps
  return <time dateTime={iso} suppressHydrationWarning>{text}</time>;
}

/** A hidden field with the browser's time zone, for forms that take a local time. */
export function TimeZoneField() {
  const [v, setV] = useState("UTC");
  useEffect(() => { try { setV(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"); } catch {} }, []);
  return <input type="hidden" name="tz" value={v} />;
}

/** The month and day of a time, in the reader's time zone (for date badges). */
export function LocalDay({ iso }: { iso: string }) {
  const parts = (tz?: string) => { const d = new Date(iso); return { m: d.toLocaleString("en-GB", { month: "short", ...(tz ? { timeZone: tz } : {}) }), d: d.toLocaleString("en-GB", { day: "numeric", ...(tz ? { timeZone: tz } : {}) }) }; };
  const [p, setP] = useState(() => parts("UTC"));
  useEffect(() => setP(parts()), [iso]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <>
      <div suppressHydrationWarning style={{ font: "700 10.5px/1.2 var(--sans)", color: "var(--signal-ink)", textTransform: "uppercase" }}>{p.m}</div>
      <div suppressHydrationWarning style={{ font: "700 20px/1.2 var(--sans)" }}>{p.d}</div>
    </>
  );
}
