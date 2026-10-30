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
export async function canReadPost(supabase: SupabaseClient<any, any, any>, post: { group_id?: string | null }, userId: string): Promise<boolean> {
  if (!post.group_id) return true;
  return isCurrent(await roleIn(supabase, post.group_id, userId));
}
