import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { peopleById } from "@/lib/people";
import { Page } from "@/components/ui";
import EventList, { type Attendance } from "@/components/events/EventList";
import type { SciEvent } from "@/lib/events";

export const dynamic = "force-dynamic";

/**
 * Everything coming up for you: your groups' talks, journal clubs and lab
 * meetings, and open events such as conferences. Members add open events
 * here; group events are added in the group.
 */
export default async function Events({ searchParams }: { searchParams: Promise<{ show?: string; error?: string; added?: string }> }) {
  const sp = await searchParams;
  const show = sp.show === "groups" || sp.show === "open" || sp.show === "going" ? sp.show : "all";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;
  const since = new Date(Date.now() - 60 * 864e5).toISOString();

  const { data: mine } = await supabase.from("group_members").select("group_id, role").eq("user_id", me);
  const groupIds = (mine ?? []).filter((m: any) => m.role !== "alumni").map((m: any) => m.group_id);
  const [{ data: open }, { data: inGroups }, { data: groups }] = await Promise.all([
    supabase.from("events").select("*").is("group_id", null).gte("starts_at", since).order("starts_at", { ascending: true }).limit(200),
    groupIds.length ? supabase.from("events").select("*").in("group_id", groupIds).gte("starts_at", since).order("starts_at", { ascending: true }).limit(300) : Promise.resolve({ data: [] as any[] }),
    groupIds.length ? supabase.from("groups").select("id, name").in("id", groupIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const all = [...((open ?? []) as SciEvent[]), ...((inGroups ?? []) as SciEvent[])];
  const ids = all.map((e) => e.id);
  const { data: att } = ids.length ? await supabase.from("event_attendees").select("event_id, user_id, status").in("event_id", ids) : { data: [] as any[] };
  const goingIds = new Set((att ?? []).filter((a: any) => a.user_id === me).map((a: any) => a.event_id));
  const events = show === "groups" ? all.filter((e) => e.group_id) : show === "open" ? all.filter((e) => !e.group_id) : show === "going" ? all.filter((e) => goingIds.has(e.id)) : all;
  const people = await peopleById(supabase, [...events.map((e) => e.created_by), ...(att ?? []).map((a: any) => a.user_id)]);
  const names = new Map<string, string>((groups ?? []).map((g: any) => [g.id, g.name]));
  const pill = (on: boolean) => ({ font: "500 12.5px/1 var(--sans)", padding: "8px 12px", borderRadius: 999, border: "1px solid var(--rule)", background: on ? "var(--ink)" : "var(--surface)", color: on ? "var(--bg)" : "var(--ink)", textDecoration: "none" });

  return (
    <Page title="Events" lede="Talks, journal clubs and lab meetings in your groups, and open meetings and conferences.">
      {sp.added === "1" && <p role="status" style={{ font: "400 13.5px/1.6 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--ok)", borderRadius: 12, background: "var(--surface)" }}>Event added.</p>}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
        <Link href="/events" style={pill(show === "all")}>All</Link>
        <Link href="/events?show=groups" style={pill(show === "groups")}>My groups</Link>
        <Link href="/events?show=open" style={pill(show === "open")}>Open events</Link>
        <Link href="/events?show=going" style={pill(show === "going")}>I am going · {goingIds.size}</Link>
      </div>
      <div style={{ maxWidth: 900 }}>
        <EventList events={events} attendance={(att ?? []) as Attendance[]} people={people} me={me} groupId={null} canAdd={show === "all" || show === "open"} canManage={false}
          groupNames={names} error={sp.error} empty={groupIds.length ? "Nothing coming up. Groups add their events under Events in the group." : "Nothing coming up. Join a group to see its talks and journal clubs here."} />
      </div>
    </Page>
  );
}
