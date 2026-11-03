/**
 * Events (supabase/21-researcher.sql): talks, journal clubs, lab meetings,
 * conferences and workshops, in a group or open to everyone, with an
 * iCalendar file for any calendar app.
 */

export const EVENT_KINDS = ["talk", "journal_club", "lab_meeting", "conference", "workshop", "other"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];
export const EVENT_LABEL: Record<EventKind, string> = {
  talk: "Talk", journal_club: "Journal club", lab_meeting: "Lab meeting", conference: "Conference", workshop: "Workshop", other: "Event",
};
export type SciEvent = {
  id: string; group_id: string | null; kind: EventKind; title: string; starts_at: string; ends_at: string | null;
  location: string; online_url: string; body: string; created_by: string; created_at: string;
};

/** How far a time zone is ahead of UTC at a moment, in minutes. */
function zoneAhead(t: number, tz: string): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(t)).map((p) => [p.type, p.value]));
  return (Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second) - Math.floor(t / 1000) * 1000) / 60000;
}

/**
 * "2026-11-12T16:00" typed in a browser in time zone `tz` (for example
 * Europe/Berlin) → an ISO time in UTC, summer time included.
 */
export function localToUtc(local: string, tz: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const guess = Date.parse(local + ":00Z");
  if (Number.isNaN(guess)) return null;
  let zone = "UTC";
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); zone = tz; } catch { /* unknown zone: UTC */ }
  let t = guess - zoneAhead(guess, zone) * 60000;
  t = guess - zoneAhead(t, zone) * 60000;   // once more, across a summer time change
  return new Date(t).toISOString();
}

const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const icsTime = (iso: string) => iso.replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Lines longer than 75 octets are folded, as RFC 5545 asks. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out.join("\r\n");
};

/** An iCalendar file with these events. */
export function icsFor(events: SciEvent[], origin: string, calName = "SciCollab"): string {
  const now = icsTime(new Date().toISOString());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//SciCollab//Events//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${icsText(calName)}`];
  for (const e of events) {
    const end = e.ends_at ?? new Date(Date.parse(e.starts_at) + 60 * 60000).toISOString();
    const url = `${origin}/events#ev-${e.id}`;
    lines.push("BEGIN:VEVENT", `UID:${e.id}@scicollab`, `DTSTAMP:${now}`, `DTSTART:${icsTime(new Date(e.starts_at).toISOString())}`, `DTEND:${icsTime(new Date(end).toISOString())}`,
      `SUMMARY:${icsText(`${e.title}`)}`, `DESCRIPTION:${icsText([EVENT_LABEL[e.kind], e.body, e.online_url ? `Online: ${e.online_url}` : "", url].filter(Boolean).join("\n\n"))}`,
      ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []), `URL:${url}`, "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
