import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/session";
import { followingOf } from "@/lib/social/follows";
import { notForChosenPeople } from "@/lib/social/groups";
import { mutesOf } from "@/lib/posts/mutes";

/**
 * How many posts arrived in the feed you are looking at since it was loaded,
 * for the "new posts" pill. Same scope as the feed: your topic groups (or one
 * of them), your groups, or the people you follow; never your own posts and
 * nothing you muted.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { supabase, user } = await sessionUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const since = sp.get("since") ?? "";
  if (Number.isNaN(Date.parse(since))) return NextResponse.json({ count: 0 });
  const feed = sp.get("feed"), room = sp.get("room"), intent = sp.get("intent");

  const [{ data: rooms }, { data: groups }, following, mutes] = await Promise.all([
    supabase.from("user_rooms").select("room_id").eq("user_id", user.id),
    supabase.from("group_members").select("group_id, role").eq("user_id", user.id),
    followingOf(supabase, user.id),
    mutesOf(supabase, user.id),
  ]);
  const groupIds = (groups ?? []).filter((g: any) => g.role !== "alumni").map((g: any) => g.group_id);
  let q = supabase.from("posts").select("id, author_id, room_id, group_id, intent, audience, created_at").gte("created_at", since);
  if (feed === "following") { if (!following.size) return NextResponse.json({ count: 0 }); q = q.in("author_id", [...following]); }
  else if (feed === "groups") { if (!groupIds.length) return NextResponse.json({ count: 0 }); q = q.in("group_id", groupIds); }
  else {
    const mine = (rooms ?? []).map((r: any) => r.room_id).filter((r: string) => !mutes.rooms.has(r));
    const scope = room ? [room] : mine;
    if (!scope.length) return NextResponse.json({ count: 0 });
    q = q.in("room_id", scope);
  }
  if (intent) q = q.eq("intent", intent);
  const { data } = await q.limit(100);
  const count = (data ?? []).filter((p: any) =>
    p.created_at > since && p.author_id !== user.id
    && (!p.group_id || groupIds.includes(p.group_id)) && notForChosenPeople(user.id)(p)
    && !mutes.posts.has(p.id) && !mutes.people.has(p.author_id) && !(p.room_id && !p.group_id && mutes.rooms.has(p.room_id) && !room),
  ).length;
  return NextResponse.json({ count });
}
