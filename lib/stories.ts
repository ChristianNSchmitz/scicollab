import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { peopleById } from "@/lib/people";

/**
 * Stories (supabase/23-stories.sql): a picture or a few words on a colour,
 * shown for 24 hours to the people who follow the author and the author's
 * group mates. The database enforces who sees what; the same rule is applied
 * here so the demo store, which has no policies, behaves the same.
 */

export const STORY_BUCKET = "story-images";
export const STORY_HOURS = 24;
export const STORY_COLOURS = ["#1B4FA0", "#0B7A4B", "#B33600", "#6B3FA0", "#0D0D0D", "#8A5A00"] as const;
export const MAX_STORY_BYTES = 1.2 * 1024 * 1024;

export type Story = { id: string; kind: "image" | "text"; src: string | null; body: string; colour: string; created_at: string; seen: boolean; views?: number };
export type StoryAuthor = { id: string; name: string; avatar: string | null; stories: Story[]; unseen: boolean; mine: boolean };

type Client = SupabaseClient<any, any, any>;

/** The authors whose stories this member may see, besides themselves. */
async function audienceOf(supabase: Client, me: string): Promise<Set<string>> {
  const [{ data: follows }, { data: mine }] = await Promise.all([
    supabase.from("follows").select("followee_id").eq("follower_id", me),
    supabase.from("group_members").select("group_id, role").eq("user_id", me),
  ]);
  const groupIds = (mine ?? []).filter((g: any) => g.role !== "alumni").map((g: any) => g.group_id);
  const { data: mates } = groupIds.length ? await supabase.from("group_members").select("user_id, role").in("group_id", groupIds) : { data: [] as any[] };
  return new Set<string>([me, ...(follows ?? []).map((f: any) => f.followee_id), ...(mates ?? []).filter((m: any) => m.role !== "alumni").map((m: any) => m.user_id)]);
}

/** Stories for the bar on top of the feed: yours first, then unseen, then seen; newest author first. */
export async function storiesFor(supabase: Client, me: string): Promise<StoryAuthor[]> {
  const authors = await audienceOf(supabase, me);
  const now = new Date().toISOString();
  const { data: rows } = await supabase.from("stories").select("id, author_id, kind, image_path, body, colour, created_at, expires_at")
    .in("author_id", [...authors]).gte("expires_at", now).order("created_at", { ascending: true }).limit(500);
  const live = (rows ?? []) as any[];
  if (!live.length) return [];
  const ids = live.map((s) => s.id);
  const mineIds = live.filter((s) => s.author_id === me).map((s) => s.id);
  const [{ data: seen }, { data: views }, people, urls] = await Promise.all([
    supabase.from("story_views").select("story_id").eq("viewer_id", me).in("story_id", ids),
    mineIds.length ? supabase.from("story_views").select("story_id").in("story_id", mineIds) : Promise.resolve({ data: [] as any[] }),
    peopleById(supabase, [...new Set(live.map((s) => s.author_id))]),
    imageUrlsFor(supabase, live.filter((s) => s.image_path).map((s) => s.image_path)),
  ]);
  const seenSet = new Set((seen ?? []).map((v: any) => v.story_id));
  const byAuthor = new Map<string, StoryAuthor>();
  for (const s of live) {
    const p = people.get(s.author_id);
    const a: StoryAuthor = byAuthor.get(s.author_id) ?? { id: s.author_id, name: p?.display_name ?? "A member", avatar: p?.avatar_url ?? null, stories: [], unseen: false, mine: s.author_id === me };
    const story: Story = {
      id: s.id, kind: s.kind, src: s.image_path ? urls.get(s.image_path) ?? null : null, body: s.body ?? "", colour: s.colour ?? STORY_COLOURS[0],
      created_at: s.created_at, seen: s.author_id === me || seenSet.has(s.id),
      ...(s.author_id === me ? { views: (views ?? []).filter((v: any) => v.story_id === s.id).length } : {}),
    };
    if (story.kind === "image" && !story.src) continue;      // a picture that cannot be shown
    a.stories.push(story);
    a.unseen ||= !story.seen;
    byAuthor.set(s.author_id, a);
  }
  const last = (a: StoryAuthor) => a.stories.at(-1)?.created_at ?? "";
  return [...byAuthor.values()].filter((a) => a.stories.length)
    .sort((a, b) => Number(b.mine) - Number(a.mine) || Number(b.unseen) - Number(a.unseen) || last(b).localeCompare(last(a)));
}

/** May this member see this author's stories? (Same rule as can_see_stories_of in the database.) */
export async function maySeeStoriesOf(supabase: Client, me: string, author: string): Promise<boolean> {
  return (await audienceOf(supabase, me)).has(author);
}

async function imageUrlsFor(supabase: Client, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  if (!isConfigured()) { for (const p of paths) if (p.startsWith("data:image/")) out.set(p, p); return out; }
  const { data } = await supabase.storage.from(STORY_BUCKET).createSignedUrls(paths, 3600);
  for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  return out;
}
