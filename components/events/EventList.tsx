import Link from "next/link";
import { Panel, Empty, btn, btnPrimary, field, fieldLabel } from "@/components/ui";
import LocalTime, { TimeZoneField, LocalDay } from "@/components/LocalTime";
import PersonLink from "@/components/social/PersonLink";
import { EVENT_KINDS, EVENT_LABEL, type SciEvent } from "@/lib/events";
import { createEvent, deleteEvent, rsvp } from "@/app/actions/events";
import type { Person } from "@/lib/people";

export type Attendance = { event_id: string; user_id: string; status: "going" | "maybe" };
const small = { font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)" } as const;
const tiny = { ...btn, height: 30, padding: "0 12px" };

const ERRORS: Record<string, string> = {
  title: "Give the event a title.", when: "Choose when it starts.", end: "The end must be after the start.",
  url: "The online link must start with https://.", limit: "That is a lot of events in a day. Try again tomorrow.", save: "That did not go through. Try again.",
};

/** One event: what, when, where, who is going, and your answer. */
function EventRow({ e, me, going, people, canDelete, groupName }: {
  e: SciEvent; me: string; going: Attendance[]; people: Map<string, Person>; canDelete: boolean; groupName?: string | null;
}) {
  const mine = going.find((a) => a.user_id === me)?.status ?? null;
  const yes = going.filter((a) => a.status === "going");
  const past = Date.parse(e.ends_at ?? e.starts_at) < Date.now();
  return (
    <div id={`ev-${e.id}`} style={{ display: "flex", gap: 12, padding: "13px 14px", borderBottom: "1px solid var(--rule)", scrollMarginTop: 72, opacity: past ? .65 : 1, flexWrap: "wrap" }}>
      <div aria-hidden="true" style={{ flex: "0 0 52px", textAlign: "center", borderRadius: 12, border: "1px solid var(--rule)", padding: "6px 0", background: "var(--surface)" }}>
        <LocalDay iso={e.starts_at} />
      </div>
      <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
        <div style={{ font: "700 14.5px/1.4 var(--sans)" }}>{e.title}</div>
        <div style={small}>
          <span style={{ fontWeight: 600, color: "var(--ink)" }}>{EVENT_LABEL[e.kind]}</span> · <LocalTime iso={e.starts_at} end={e.ends_at} />
          {e.location && <> · {e.location}</>}
          {groupName !== undefined && <> · {e.group_id ? (groupName ? <Link href={`/groups/${e.group_id}?tab=events`} style={{ color: "var(--ink)" }}>{groupName}</Link> : "a group") : "open to everyone"}</>}
        </div>
        {e.body && <div style={{ font: "400 13px/1.6 var(--sans)", whiteSpace: "pre-wrap" }}>{e.body}</div>}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
          {!past && <>
            <form action={rsvp.bind(null, e.id, mine === "going" ? null : "going")}><button type="submit" style={mine === "going" ? { ...btnPrimary, height: 30 } : tiny} aria-pressed={mine === "going"}>{mine === "going" ? "Going ✓" : "Going"}</button></form>
            <form action={rsvp.bind(null, e.id, mine === "maybe" ? null : "maybe")}><button type="submit" style={mine === "maybe" ? { ...tiny, background: "var(--ink)", color: "var(--bg)" } : tiny} aria-pressed={mine === "maybe"}>Maybe</button></form>
          </>}
          {e.online_url && !past && <a href={e.online_url} target="_blank" rel="noopener noreferrer" style={tiny}>Join online ↗</a>}
          <a href={`/api/events/ics?event=${e.id}`} style={{ ...small, color: "var(--link)" }}>Add to calendar</a>
          <span style={small}>
            {yes.length ? `${yes.slice(0, 3).map((a) => people.get(a.user_id)?.display_name ?? "a member").join(", ")}${yes.length > 3 ? ` and ${yes.length - 3} more` : ""} going` : "nobody said yet"}
            {" · "}by <PersonLink id={e.created_by} style={{ color: "var(--ink)" }}>{people.get(e.created_by)?.display_name ?? "a member"}</PersonLink>
          </span>
          {canDelete && <form action={deleteEvent.bind(null, e.id)} style={{ marginLeft: "auto" }}><button type="submit" style={{ ...tiny, borderColor: "var(--err)", color: "var(--err)" }}>Delete</button></form>}
        </div>
      </div>
    </div>
  );
}

/** Upcoming events, the last few past ones, and a form to add one. */
export default function EventList({ events, attendance, people, me, groupId, canAdd, canManage, groupNames, error, title, empty }: {
  events: SciEvent[]; attendance: Attendance[]; people: Map<string, Person>; me: string;
  /** null: open events (the Events page); a group's id: that group's events. */
  groupId: string | null; canAdd: boolean; canManage: boolean;
  /** On the Events page: names of the groups, to say where an event belongs. */
  groupNames?: Map<string, string>; error?: string; title?: string; empty?: string;
}) {
  const now = Date.now();
  const upcoming = events.filter((e) => Date.parse(e.ends_at ?? e.starts_at) >= now).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const past = events.filter((e) => Date.parse(e.ends_at ?? e.starts_at) < now).sort((a, b) => b.starts_at.localeCompare(a.starts_at)).slice(0, 5);
  const row = (e: SciEvent) => (
    <EventRow key={e.id} e={e} me={me} going={attendance.filter((a) => a.event_id === e.id)} people={people}
      canDelete={e.created_by === me || canManage} groupName={groupNames ? (e.group_id ? groupNames.get(e.group_id) ?? null : null) : undefined} />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Panel>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: "1px solid var(--rule)", flexWrap: "wrap" }}>
          <b style={{ flex: 1, font: "700 14px/1.4 var(--sans)" }}>{title ?? "Upcoming"} · {upcoming.length}</b>
          {groupId ? <a href={`/api/events/ics?group=${groupId}`} style={{ ...small, color: "var(--link)" }}>All as calendar file</a>
            : <a href="/api/events/ics?mine=1" style={{ ...small, color: "var(--link)" }}>Everything I am going to, as calendar file</a>}
        </div>
        {upcoming.length === 0 && <Empty>{empty ?? "Nothing planned yet."}</Empty>}
        {upcoming.map(row)}
      </Panel>
      {past.length > 0 && (
        <details className="sc-more-replies">
          <summary style={{ listStyle: "none", cursor: "pointer", width: "fit-content", font: "600 12.5px/1.5 var(--sans)", color: "var(--mute)" }}>
            <span className="sc-when-closed">Past events · {past.length}</span><span className="sc-when-open">Hide past events</span>
          </summary>
          <div style={{ marginTop: 8 }}><Panel>{past.map(row)}</Panel></div>
        </details>
      )}
      {canAdd && (
        <Panel>
          <div id="new-event" style={{ scrollMarginTop: 72, padding: "12px 14px 0", font: "700 14px/1.4 var(--sans)" }}>{groupId ? "Add an event for the group" : "Add an open event"}</div>
          {error && ERRORS[error] && <p role="alert" style={{ margin: "8px 14px 0", font: "400 13px/1.6 var(--sans)", color: "var(--err)" }}>{ERRORS[error]}</p>}
          <form action={createEvent.bind(null, groupId)} style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <TimeZoneField />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ ...fieldLabel, flex: "3 1 240px" }}>Title<input name="title" required minLength={2} maxLength={200} placeholder={groupId ? "Journal club: Smith et al. 2026" : "Spring meeting of the society"} style={{ ...field, marginTop: 4 }} /></label>
              <label style={{ ...fieldLabel, flex: "1 1 140px" }}>Kind
                <select name="kind" defaultValue={groupId ? "journal_club" : "conference"} style={{ ...field, marginTop: 4 }}>{EVENT_KINDS.map((k) => <option key={k} value={k}>{EVENT_LABEL[k]}</option>)}</select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ ...fieldLabel, flex: "1 1 180px" }}>Starts<input name="starts" type="datetime-local" required style={{ ...field, marginTop: 4 }} /></label>
              <label style={{ ...fieldLabel, flex: "1 1 180px" }}>Ends (optional)<input name="ends" type="datetime-local" style={{ ...field, marginTop: 4 }} /></label>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <label style={{ ...fieldLabel, flex: "1 1 180px" }}>Where<input name="location" maxLength={200} placeholder="Seminar room 2, or a city" style={{ ...field, marginTop: 4 }} /></label>
              <label style={{ ...fieldLabel, flex: "1 1 180px" }}>Online link (optional)<input name="online_url" type="url" maxLength={500} placeholder="https://" style={{ ...field, marginTop: 4 }} /></label>
            </div>
            <label style={fieldLabel}>Details<textarea name="body" rows={3} maxLength={4000} placeholder={groupId ? "Who presents, what to read beforehand." : "Programme, registration, fees."} style={{ ...field, marginTop: 4 }} /></label>
            <div><button type="submit" style={btnPrimary}>Add event</button>{groupId && <span style={{ ...small, marginLeft: 10 }}>Members are told right away.</span>}</div>
          </form>
        </Panel>
      )}
    </div>
  );
}
