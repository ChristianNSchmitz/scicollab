"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { sessionUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { isConfigured } from "@/lib/mode";
import { overLimit } from "@/lib/ratelimit";
import { STORY_BUCKET, STORY_COLOURS, STORY_HOURS, MAX_STORY_BYTES, maySeeStoriesOf } from "@/lib/stories";

/** Stories (supabase/23-stories.sql): post one, delete your own, mark what you have seen. */

type Result = { ok: true } | { error: string };
const TYPES = ["image/jpeg", "image/png", "image/webp"];

export async function postStory(form: FormData): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  if (await overLimit(supabase, "story", user.id)) return { error: "That is a lot of stories today. Try again tomorrow." };
  const body = String(form.get("body") ?? "").trim().slice(0, 280);
  const colourIn = String(form.get("colour") ?? "");
  const colour = (STORY_COLOURS as readonly string[]).includes(colourIn) ? colourIn : STORY_COLOURS[0];
  const file = form.get("image");
  const id = randomUUID();
  let image_path: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (!TYPES.includes(file.type)) return { error: "A JPEG, PNG or WebP picture." };
    if (file.size > MAX_STORY_BYTES) return { error: "That picture is too large." };
    if (isConfigured()) {
      const path = `${user.id}/${id}.${file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg"}`;
      const { error } = await supabase.storage.from(STORY_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) return { error: "The picture did not upload. Try again." };
      image_path = path;
    } else {
      image_path = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
  } else if (!body) {
    return { error: "Add a picture or write something." };
  }
  const now = Date.now();
  const { error } = await supabase.from("stories").insert({
    id, author_id: user.id, kind: image_path ? "image" : "text", image_path, body, colour,
    created_at: new Date(now).toISOString(), expires_at: new Date(now + STORY_HOURS * 3600e3).toISOString(),
  });
  if (error) {
    if (image_path && isConfigured()) await supabase.storage.from(STORY_BUCKET).remove([image_path]);
    return { error: "The story did not go up. Try again." };
  }
  revalidatePath("/home");
  return { ok: true };
}

export async function deleteStory(storyId: string): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  if (!isRowId(storyId)) return { error: "That story is gone." };
  const { data: s } = await supabase.from("stories").select("author_id, image_path").eq("id", storyId).maybeSingle();
  if (!s || s.author_id !== user.id) return { error: "Only its author can delete a story." };
  await supabase.from("story_views").delete().eq("story_id", storyId);
  await supabase.from("stories").delete().eq("id", storyId).eq("author_id", user.id);
  if (isConfigured() && s.image_path) await supabase.storage.from(STORY_BUCKET).remove([s.image_path]);
  revalidatePath("/home");
  return { ok: true };
}

/** Remember which stories you have seen (only ones you may see). */
export async function markStoriesSeen(storyIds: string[]): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const ids = [...new Set((storyIds ?? []).filter(isRowId))].slice(0, 50);
  if (!ids.length) return { ok: true };
  const [{ data: stories }, { data: had }] = await Promise.all([
    supabase.from("stories").select("id, author_id, expires_at").in("id", ids),
    supabase.from("story_views").select("story_id").eq("viewer_id", user.id).in("story_id", ids),
  ]);
  const done = new Set((had ?? []).map((v: any) => v.story_id));
  const now = new Date().toISOString();
  const authors = new Map<string, boolean>();
  const rows = [];
  let refused = 0;
  for (const s of (stories ?? []) as any[]) {
    if (done.has(s.id) || s.author_id === user.id || s.expires_at < now) continue;
    if (!authors.has(s.author_id)) authors.set(s.author_id, await maySeeStoriesOf(supabase, user.id, s.author_id));
    if (authors.get(s.author_id)) rows.push({ story_id: s.id, viewer_id: user.id, seen_at: now }); else refused++;
  }
  if (rows.length) await supabase.from("story_views").insert(rows);
  return refused && !rows.length ? { error: "Those stories are not shared with you." } : { ok: true };
}
