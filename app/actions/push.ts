"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, sessionUser } from "@/lib/session";
import { isPushEndpoint, pushConfigured, sendPush } from "@/lib/webpush";

/** Push messages on this device, and which notifications come right away (lib/notify.ts). */

type Result = { ok: true } | { error: string };
const b64u = (s: unknown, min: number, max: number) => typeof s === "string" && /^[A-Za-z0-9_-]+$/.test(s) && s.length >= min && s.length <= max;

export async function savePushSubscription(sub: { endpoint: string; keys: { p256dh: string; auth: string } }): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  if (!pushConfigured()) return { error: "Push messages are not set up on this server yet." };
  if (!isPushEndpoint(sub?.endpoint) || sub.endpoint.length > 1000 || !b64u(sub.keys?.p256dh, 80, 100) || !b64u(sub.keys?.auth, 16, 32)) return { error: "This browser gave an address that cannot be used." };
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({ endpoint: sub.endpoint, user_id: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, created_at: new Date().toISOString() });
  return error ? { error: "That did not work, try again." } : { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  await supabase.from("push_subscriptions").delete().eq("endpoint", String(endpoint ?? "")).eq("user_id", user.id);
  return { ok: true };
}

/** A test message to every device of yours. */
export async function testPush(): Promise<Result> {
  const { supabase, user } = await sessionUser();
  if (!user) return { error: "Sign in first." };
  const { data: subs } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", user.id);
  if (!(subs ?? []).length) return { error: "No device is switched on yet." };
  let ok = 0;
  for (const s of subs ?? []) {
    const r = await sendPush(s, { title: "SciCollab", body: "Push messages work on this device.", url: "/notifications" });
    if (r === "ok") ok++;
    if (r === "gone") await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  }
  return ok ? { ok: true } : { error: "The push service did not accept the message." };
}

export async function saveNotifications(form: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from("profiles").update({ notify_email: form.get("notify_email") === "on", notify_push: form.get("notify_push") === "on" }).eq("id", user.id);
  revalidatePath("/settings");
  redirect("/settings?saved=notifications#notifications");
}
