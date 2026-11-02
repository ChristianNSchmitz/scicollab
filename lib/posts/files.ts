import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";

/**
 * Files on a post: the draft, poster or figures a feedback request is about
 * (supabase/15). Against Supabase they live in the private post-files bucket
 * under "<post>/<file>/<name>" and are opened through short-lived links
 * (app/api/post-files/[id]). In demo mode they are kept inline.
 */

export const POST_FILE_BUCKET = "post-files";
export const MAX_POST_FILES = 3;
/** Per file. With the images of a post this stays under the 4 MB request limit (next.config.ts). */
export const MAX_POST_FILE_BYTES = 3 * 1024 * 1024;
export const POST_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

/** Why these files cannot be attached, or null. */
export function checkPostFiles(files: File[]): string | null {
  if (files.length > MAX_POST_FILES) return `At most ${MAX_POST_FILES} files per post.`;
  if (files.some((f) => !POST_FILE_TYPES.includes(f.type))) return "Files must be PDF, JPEG, PNG or WebP.";
  if (files.some((f) => f.size > MAX_POST_FILE_BYTES)) return "Each file can be up to 3 MB. Export the PDF at a lower resolution, or share a link.";
  if (files.reduce((n, f) => n + f.size, 0) > MAX_POST_FILE_BYTES + 512 * 1024) return "Together the files are too large for one post (3.5 MB at most).";
  return null;
}

export async function storePostFiles(supabase: SupabaseClient<any, any, any>, userId: string, postId: string, files: File[]): Promise<void> {
  for (const file of files.slice(0, MAX_POST_FILES)) {
    const id = randomUUID();
    const name = file.name.replace(/[\\/\u0000-\u001f]/g, "_").slice(0, 200) || "file";
    let path: string;
    if (isConfigured()) {
      path = `${postId}/${id}/${name}`;
      const { error } = await supabase.storage.from(POST_FILE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (error) continue;
    } else {
      path = `data:${file.type};base64,${Buffer.from(await file.arrayBuffer()).toString("base64")}`;
    }
    await supabase.from("post_files").insert({ id, post_id: postId, uploaded_by: userId, name, mime: file.type, size_bytes: file.size, path });
  }
}
