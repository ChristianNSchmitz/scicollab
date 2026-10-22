"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/mode";
import { parseAvatar, presetValue } from "@/lib/avatar";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Everywhere a person is drawn reads the profile, so all of it is refreshed. */
function refreshEverywhere() {
  revalidatePath("/", "layout");
}

/** The ORCID is linked separately (app/actions/orcid.ts), so it is checked
 *  and synced as one step; this form never touches it. */
export async function saveProfile(form: FormData) {
  const { supabase, user } = await me();
  const name = String(form.get("display_name") ?? "").trim();
  if (!name) redirect("/settings?error=name#profile");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: name.slice(0, 120),
      institution:  String(form.get("institution") ?? "").trim().slice(0, 200),
      role_title:   String(form.get("role_title") ?? "").trim().slice(0, 120),
      field:        String(form.get("field") ?? "").trim().slice(0, 120),
      techniques:   String(form.get("techniques") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 30),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  refreshEverywhere();
  redirect("/settings?saved=profile#profile");
}

/** A built-in picture, or back to the initial. */
export async function setAvatarPreset(icon: string, colour: string) {
  const { supabase, user } = await me();
  const value = presetValue(icon, colour);
  if (parseAvatar(value).kind !== "preset") return { error: "Unknown picture." };
  const { error } = await supabase.from("profiles").update({ avatar_url: value }).eq("id", user.id);
  if (error) return { error: error.message };
  refreshEverywhere();
  return { ok: true as const };
}

export async function clearAvatar() {
  const { supabase, user } = await me();
  const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", user.id);
  if (error) return { error: error.message };
  refreshEverywhere();
  return { ok: true as const };
}

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 2 * 1024 * 1024;

/**
 * An uploaded picture. The browser crops and scales it to a 256px square
 * before sending, so what arrives is small; the checks here are the guard,
 * not the courtesy. SVG is refused on purpose: it can carry script.
 */
export async function uploadAvatar(form: FormData) {
  const { supabase, user } = await me();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image first." };
  if (!TYPES.includes(file.type)) return { error: "Use a JPEG, PNG or WebP image." };
  if (file.size > MAX_BYTES) return { error: "That image is over 2 MB, even after scaling." };

  let url: string;
  if (isConfigured()) {
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type, upsert: false });
    if (error) return { error: `Upload failed: ${error.message}` };
    url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    // Older uploads are no longer referenced; keep only the new one.
    const { data: old } = await supabase.storage.from("avatars").list(user.id);
    const stale = (old ?? []).map((o) => `${user.id}/${o.name}`).filter((p) => p !== path);
    if (stale.length) await supabase.storage.from("avatars").remove(stale);
  } else {
    // Demo mode has no storage; the scaled image is small enough to keep inline.
    const buf = Buffer.from(await file.arrayBuffer());
    url = `data:${file.type};base64,${buf.toString("base64")}`;
  }

  const { error } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
  if (error) return { error: error.message };
  refreshEverywhere();
  return { ok: true as const, url };
}
