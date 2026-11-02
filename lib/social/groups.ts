import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Roles in a group (supabase/11-groups-and-moderation.sql):
 * owner leads the group and is the only one who can delete it or make
 * other owners; admin manages members, requests and invitations; member
 * and guest take part (a guest is a collaborator from elsewhere); alumni
 * are former members, still credited, without access to the discussions.
 */
export type GroupRole = "owner" | "admin" | "member" | "guest" | "alumni";
export const ROLES: GroupRole[] = ["owner", "admin", "member", "guest", "alumni"];
export const ROLE_LABEL: Record<GroupRole, string> = {
  owner: "Lead", admin: "Admin", member: "Member", guest: "Guest", alumni: "Alumni",
};
export const isRole = (v: string): v is GroupRole => (ROLES as string[]).includes(v);

/** Manages members, requests and invitations. */
export const canManage = (role?: string | null) => role === "owner" || role === "admin";
/** A current member: sees and writes the group's discussions. */
export const isCurrent = (role?: string | null) => !!role && role !== "alumni";

export async function roleIn(supabase: SupabaseClient<any, any, any>, groupId: string, userId: string): Promise<GroupRole | null> {
  const { data } = await supabase.from("group_members").select("role").eq("group_id", groupId).eq("user_id", userId).maybeSingle();
  return (data?.role as GroupRole) ?? null;
}

/** The groups someone currently belongs to (alumni excluded). */
export async function currentGroupIds(supabase: SupabaseClient<any, any, any>, userId: string): Promise<string[]> {
  const { data } = await supabase.from("group_members").select("group_id, role").eq("user_id", userId);
  return (data ?? []).filter((m: any) => m.role !== "alumni").map((m: any) => m.group_id);
}

/**
 * Whether someone may read a post: everyone signed in for posts in topic
 * groups, current members only for a group's discussion. The database says
 * the same (posts_read); this keeps the demo store and every page honest.
 */
export async function canReadPost(
  supabase: SupabaseClient<any, any, any>,
  post: { id?: string; group_id?: string | null; audience?: string | null; author_id?: string | null },
  userId: string,
): Promise<boolean> {
  if (post.group_id) return isCurrent(await roleIn(supabase, post.group_id, userId));
  // A post for chosen people (supabase/15): its author and those people.
  let { audience, author_id } = post;
  if (audience === undefined && post.id) {
    const { data } = await supabase.from("posts").select("audience, author_id").eq("id", post.id).maybeSingle();
    audience = data?.audience; author_id = data?.author_id;
  }
  if (audience !== "people" || author_id === userId) return true;
  const { data: row } = await supabase.from("post_audience").select("user_id").eq("post_id", post.id ?? "").eq("user_id", userId).maybeSingle();
  return !!row;
}

/** Lists of posts: drop those meant for chosen people, unless written by the viewer (the database does the same, supabase/15). */
export const notForChosenPeople = (viewer: string) => (p: { audience?: string | null; author_id?: string | null }) =>
  p.audience !== "people" || p.author_id === viewer;
