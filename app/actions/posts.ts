"use server";

import { overLimit } from "@/lib/ratelimit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { intentById } from "@/lib/taxonomy";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export type PostState = { error: string } | null;

/** Returns a message rather than throwing: a validation failure belongs on
 *  the form next to the field, not in an error boundary. */
export async function createPost(_prev: PostState, form: FormData): Promise<PostState> {
  const { supabase, user } = await me();

  const limited = await overLimit(supabase, "post", user.id);
  if (limited) return { error: limited };

  const intent = String(form.get("intent") ?? "");
  const spec = intentById(intent);
  if (!spec) return { error: "Pick what kind of post this is." };

  const room = String(form.get("room_id") ?? "");
  if (!room) return { error: "Choose a room to post in." };

  const card = String(form.get("method_card_id") ?? "");
  // The intents that exist to carry evidence must carry it. This is the rule
  // that keeps the feed anchored to artifacts rather than to opinion.
  if (spec.needsArtifact && !card) {
    return { error: `“${spec.label}” needs a method card attached. Pick one in the method card field, or choose a different kind of post.` };
  }

  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id,
      room_id: room,
      intent,
      title: String(form.get("title") ?? "").trim(),
      body: String(form.get("body") ?? "").trim(),
      method_card_id: card || null,
      technique: String(form.get("technique") ?? "").trim(),
      organism: String(form.get("organism") ?? "").trim(),
      deadline: String(form.get("deadline") ?? "") || null,
      offer: String(form.get("offer") ?? "").trim(),
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // Optional project evidence, with its disclosure setting. "attach" arrives
  // as "<kind>:<id>" so one control can offer datasets and code together.
  const attach = String(form.get("attach") ?? "");
  if (attach) {
    const [kind, refId] = attach.split(":");
    const access = String(form.get("access") ?? "on_request") === "open" ? "open" : "on_request";

    if (kind === "dataset" || kind === "code") {
      const table = kind === "dataset" ? "datasets" : "code_files";
      const { data: ref } = await supabase
        .from(table).select("id, project_id").eq("id", refId).maybeSingle();

      if (ref) {
        await supabase.from("post_attachments").insert({
          post_id: data.id,
          kind,
          dataset_id:   kind === "dataset" ? ref.id : null,
          code_file_id: kind === "code"    ? ref.id : null,
          project_id:   ref.project_id,
          access,
          owner_id: user.id,
        });
      }
    }
  }

  revalidatePath("/home");
  redirect(`/posts/${data.id}`);
}

/** Share an existing card into a room — the loop that puts a recorded
 *  result in front of the people who would repeat it. */
export async function shareCardToRoom(cardId: string, roomId: string, title: string) {
  const { supabase, user } = await me();
  const { data, error } = await supabase
    .from("posts")
    .insert({
      author_id: user.id, room_id: roomId, intent: "result",
      title, body: "", method_card_id: cardId,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  revalidatePath("/home");
  redirect(`/posts/${data.id}`);
}
