import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";

/**
 * Images on posts. Against Supabase they live in the private post-images
 * bucket (supabase/09-feed-and-group-projects.sql) and are shown through
 * links that expire after an hour, so an image is no more public than the
 * post it belongs to. In demo mode there is no storage: the browser has
 * already scaled the picture down, and it is kept inline as a data: URL.
 */

export const MAX_IMAGES = 4;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
/** Per image, after the browser scaled it; four of them stay under the 4 MB request limit (next.config.ts). */
export const MAX_IMAGE_BYTES = 1.2 * 1024 * 1024;
const BUCKET = "post-images";

type Client = SupabaseClient<any, any, any>;

/** Store the images of a new post; returns what goes in posts.images. */
export async function storeImages(supabase: Client, userId: string, postId: string, files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (const [i, file] of files.slice(0, MAX_IMAGES).entries()) {
    if (!IMAGE_TYPES.includes(file.type) || file.size === 0 || file.size > MAX_IMAGE_BYTES) continue;
    if (isConfigured()) {
      const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${userId}/${postId}/${i}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (!error) out.push(path);
    } else {
      out.push(`data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`);
    }
  }
  return out;
}

/** Displayable URLs for the images of these posts, keyed by post id. */
export async function imageUrls(supabase: Client, posts: { id: string; images?: string[] | null }[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const paths = posts.flatMap((p) => p.images ?? []);
  if (!paths.length) return out;
  if (!isConfigured()) {
    for (const p of posts) if (p.images?.length) out.set(p.id, p.images.filter((u) => u.startsWith("data:image/")));
    return out;
  }
  const { data } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  const signed = new Map((data ?? []).map((d: any) => [d.path, d.signedUrl as string]));
  for (const p of posts) {
    const urls = (p.images ?? []).map((path) => signed.get(path)).filter(Boolean) as string[];
    if (urls.length) out.set(p.id, urls);
  }
  return out;
}

/** Remove a deleted post's images from storage. */
export async function removeImages(supabase: Client, images: string[] | null | undefined) {
  const paths = (images ?? []).filter((p) => !p.startsWith("data:"));
  if (isConfigured() && paths.length) await supabase.storage.from(BUCKET).remove(paths);
}
