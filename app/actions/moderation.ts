"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { isModerator } from "@/lib/moderation";
import { removeImages } from "@/lib/posts/images";

/**
 * The moderation inbox's actions. Closing a report records who closed it,
 * when and why; removing content deletes the post, reply, answer or question
 * (with what hangs off it) and closes every open report about it.
 */
async function moderator() {
  const { supabase, user } = await requireUser();
  if (!(await isModerator(supabase, user.id))) throw new Error("Only moderators can do this.");
  return { supabase, user };
}

export async function closeReport(reportId: string, outcome: "resolved" | "dismissed", form: FormData) {
  const { supabase, user } = await moderator();
  await supabase.from("reports").update({
    status: outcome, resolved_by: user.id, resolved_at: new Date().toISOString(),
    resolution: String(form.get("note") ?? "").trim().slice(0, 500) || (outcome === "dismissed" ? "No action needed." : "Handled."),
  }).eq("id", reportId);
  revalidatePath("/moderation");
}

export async function removeReported(reportId: string, form: FormData) {
  const { supabase, user } = await moderator();
  const { data: r } = await supabase.from("reports").select("target_kind, target_id").eq("id", reportId).maybeSingle();
  if (!r) return;
  const id = r.target_id as string;
  if (r.target_kind === "post") {
    const { data: post } = await supabase.from("posts").select("images").eq("id", id).maybeSingle();
    await supabase.from("post_replies").delete().eq("post_id", id);
    await supabase.from("posts").delete().eq("id", id);
    await removeImages(supabase, post?.images);
  } else if (r.target_kind === "reply") {
    await supabase.from("post_replies").delete().eq("id", id);
  } else if (r.target_kind === "answer") {
    await supabase.from("answers").delete().eq("id", id);
  } else if (r.target_kind === "question") {
    await supabase.from("answers").delete().eq("question_id", id);
    await supabase.from("questions").delete().eq("id", id);
  } else {
    return;   // people and conversations are handled by the team, not removed from here
  }
  const note = String(form.get("note") ?? "").trim().slice(0, 500) || "Content removed.";
  await supabase.from("reports").update({ status: "resolved", resolved_by: user.id, resolved_at: new Date().toISOString(), resolution: note })
    .eq("target_kind", r.target_kind).eq("target_id", id).eq("status", "open");
  revalidatePath("/moderation");
  revalidatePath("/home");
}
