import type { SupabaseClient } from "@supabase/supabase-js";
import type { Person } from "@/lib/people";
import type { CoauthorMember } from "@/lib/social/coauthors";

export type Contact = { person: Person; reason: string };

const DAY = 864e5;

/**
 * People you may want to know, each with the one reason that says why:
 * your co-authors first (you already know them), then people who list your
 * techniques, then people in your topic groups, with new members nudged up
 * so they find someone on their first day. Nobody you already follow.
 */
export async function peopleYouMayKnow(
  supabase: SupabaseClient<any, any, any>, me: string,
  opts: { coauthors: CoauthorMember[]; following: Set<string>; myRooms: string[]; limit?: number },
): Promise<Contact[]> {
  const [{ data: mine }, { data: people }, { data: roomies }] = await Promise.all([
    supabase.from("profiles").select("techniques").eq("id", me).maybeSingle(),
    supabase.from("profiles").select("id, display_name, institution, avatar_url, techniques, created_at").neq("id", me).limit(500),
    opts.myRooms.length ? supabase.from("user_rooms").select("user_id, room_id").in("room_id", opts.myRooms) : Promise.resolve({ data: [] as any[] }),
  ]);
  const myTech = new Set(((mine?.techniques ?? []) as string[]).map((t) => t.toLowerCase()));
  const shared = new Map<string, string[]>();
  for (const r of roomies ?? []) if (r.user_id !== me) shared.set(r.user_id, [...(shared.get(r.user_id) ?? []), r.room_id]);
  const co = new Map(opts.coauthors.map((c) => [c.person.id, c.papers]));

  return (people ?? [])
    .filter((p: any) => !opts.following.has(p.id) && p.display_name)
    .map((p: any) => {
      const tech = ((p.techniques ?? []) as string[]).filter((t) => myTech.has(t.toLowerCase()));
      const rooms = shared.get(p.id) ?? [];
      const papers = co.get(p.id) ?? 0;
      const isNew = Date.now() - +new Date(p.created_at) < 30 * DAY;
      const score = papers * 100 + tech.length * 10 + rooms.length * 2 + (isNew ? 3 : 0);
      const reason = papers ? `${papers} paper${papers > 1 ? "s" : ""} together`
        : tech.length ? `also does ${tech.slice(0, 2).join(" and ")}`
        : rooms.length ? `in #${rooms[0]}${rooms.length > 1 ? ` and ${rooms.length - 1} more` : ""}`
        : isNew ? "new here" : "";
      return { person: { id: p.id, display_name: p.display_name, institution: p.institution ?? "", avatar_url: p.avatar_url ?? null }, reason, score };
    })
    .filter((c: any) => c.score > 0)
    .sort((a: any, b: any) => b.score - a.score)
    .slice(0, opts.limit ?? 4)
    .map(({ person, reason }: any) => ({ person, reason }));
}
