import { peopleById } from "@/lib/people";
import EventList, { type Attendance } from "@/components/events/EventList";
import type { SciEvent } from "@/lib/events";
import type { GroupCtx } from "./ctx";

/** The group's calendar: talks, journal clubs, lab meetings; members add and answer. */
export default async function GroupEvents({ ctx }: { ctx: GroupCtx }) {
  const { supabase, id, me, member, manage, sp } = ctx;
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const { data: rows } = await supabase.from("events").select("*").eq("group_id", id).gte("starts_at", since).order("starts_at", { ascending: true }).limit(200);
  const events = (rows ?? []) as SciEvent[];
  const ids = events.map((e) => e.id);
  const { data: att } = ids.length ? await supabase.from("event_attendees").select("event_id, user_id, status").in("event_id", ids) : { data: [] as any[] };
  const people = new Map([...ctx.people, ...(await peopleById(supabase, [...events.map((e) => e.created_by), ...(att ?? []).map((a: any) => a.user_id)].filter((x) => !ctx.people.has(x))))]);
  return (
    <div style={{ maxWidth: 900 }}>
      {sp.added === "1" && <p role="status" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--ok)", borderRadius: 12, background: "var(--surface)" }}>Event added. Members were told.</p>}
      <EventList events={events} attendance={(att ?? []) as Attendance[]} people={people} me={me} groupId={id} canAdd={member} canManage={manage} error={sp.error}
        empty="Nothing planned. Add the next journal club or lab meeting below." />
    </div>
  );
}
