"use server";

import { notifyNow, nameOf, quote, snippet } from "@/lib/notify";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { safeBack } from "@/lib/calls";

/**
 * Calls for collaborators (supabase/15): say you are interested with a short
 * pitch; the caller shortlists and marks the call filled or closed. Only the
 * caller and the person interested see an answer to a call.
 */

const STATUSES = ["open", "filled", "closed"] as const;

async function callOf(supabase: any, postId: string) {
  if (!isRowId(postId)) return null;
  const { data } = await supabase.from("posts").select("id, author_id, intent, call_status, group_id, audience").eq("id", postId).maybeSingle();
  return data?.intent === "collab" ? data : null;
}

export async function expressInterest(postId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const call = await callOf(supabase, postId);
  if (!call) throw new Error("That call no longer exists.");
  if (call.author_id === user.id) throw new Error("This is your own call.");
  if ((call.call_status ?? "open") !== "open") redirect(`/posts/${postId}?call=closed#call`);
  const pitch = String(form.get("pitch") ?? "").trim().slice(0, 1000);
  const { data: had } = await supabase.from("call_interest").select("user_id").eq("post_id", postId).eq("user_id", user.id).maybeSingle();
  if (had) await supabase.from("call_interest").update({ pitch }).eq("post_id", postId).eq("user_id", user.id);
  else {
    await supabase.from("call_interest").insert({ post_id: postId, user_id: user.id, pitch, shortlisted: false });
    await notifyNow([call.author_id], { kind: "interest", title: `${await nameOf(supabase, user.id)} is interested in your call`, body: snippet(pitch), href: `/posts/${postId}#call` }, user.id);
  }
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/home");
  // Back to the feed, or the Calls tab, where the person was; anything else goes to the call itself.
  const back = safeBack(form.get("back"));
  redirect(back ? `${back}${back.includes("?") ? "&" : "?"}sent=1#post-${postId}` : `/posts/${postId}?interest=1#call`);
}

export async function withdrawInterest(postId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("call_interest").delete().eq("post_id", postId).eq("user_id", user.id);
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/home");
}

export async function setShortlisted(postId: string, personId: string, on: boolean) {
  const { supabase, user } = await requireUser();
  const call = await callOf(supabase, postId);
  if (!call || call.author_id !== user.id) throw new Error("Only the caller shortlists.");
  await supabase.from("call_interest").update({ shortlisted: on }).eq("post_id", postId).eq("user_id", personId);
  revalidatePath(`/posts/${postId}`);
}

export async function setCallStatus(postId: string, form: FormData) {
  const { supabase, user } = await requireUser();
  const call = await callOf(supabase, postId);
  if (!call || call.author_id !== user.id) throw new Error("Only the caller changes the status.");
  const status = String(form.get("status") ?? "");
  if (!(STATUSES as readonly string[]).includes(status)) return;
  await supabase.from("posts").update({ call_status: status }).eq("id", postId).eq("author_id", user.id);
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/home");
}
