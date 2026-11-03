import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { roleIn, isCurrent } from "@/lib/social/groups";
import { icsFor, type SciEvent } from "@/lib/events";

/**
 * Events as an iCalendar file: one event (?event=…), a group's upcoming
 * events (?group=…, members only), or everything you are going to (?mine=1).
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { supabase, user } = await sessionUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const origin = process.env.SCICOLLAB_SITE_URL || new URL(req.url).origin;
  const since = new Date(Date.now() - 30 * 864e5).toISOString();
  let events: SciEvent[] = [];
  let name = "SciCollab";
  const readable = async (e: SciEvent) => !e.group_id || isCurrent(await roleIn(supabase, e.group_id, user.id));

  if (sp.get("event")) {
    const id = sp.get("event")!;
    if (!isRowId(id)) return new NextResponse("Not found.", { status: 404 });
    const { data } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
    if (!data || !(await readable(data as SciEvent))) return new NextResponse("Not found.", { status: 404 });
    events = [data as SciEvent];
    name = (data as SciEvent).title;
  } else if (sp.get("group")) {
    const gid = sp.get("group")!;
    if (!isRowId(gid) || !isCurrent(await roleIn(supabase, gid, user.id))) return new NextResponse("Not found.", { status: 404 });
    const [{ data }, { data: g }] = await Promise.all([
      supabase.from("events").select("*").eq("group_id", gid).gte("starts_at", since).order("starts_at", { ascending: true }),
      supabase.from("groups").select("name").eq("id", gid).maybeSingle(),
    ]);
    events = (data ?? []) as SciEvent[];
    name = g?.name ?? "Group events";
  } else {
    const { data: going } = await supabase.from("event_attendees").select("event_id").eq("user_id", user.id);
    const ids = (going ?? []).map((x: any) => x.event_id);
    const { data } = ids.length ? await supabase.from("events").select("*").in("id", ids).gte("starts_at", since) : { data: [] };
    events = [];
    for (const e of (data ?? []) as SciEvent[]) if (await readable(e)) events.push(e);
    name = "My SciCollab events";
  }
  return new NextResponse(icsFor(events, origin, name), {
    headers: { "content-type": "text/calendar; charset=utf-8", "content-disposition": `attachment; filename="${name.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 60) || "events"}.ics"`, "cache-control": "private, no-store" },
  });
}
