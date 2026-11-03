import { after } from "next/server";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { isConfigured } from "@/lib/mode";
import { memberMailConfigured, sendToMember } from "@/lib/mail";
import { pushConfigured, sendPush } from "@/lib/webpush";

/**
 * Right-away notifications for what needs an answer: a reply to your post,
 * an answer to your question, an access or full-text request, a mention,
 * interest in your call, a direct message, a new event in your group.
 * By e-mail (Brevo, lib/mail.ts) and as a push message on every device where
 * the member switched it on (lib/webpush.ts). Each member chooses in Settings.
 *
 * Sent after the response (next/server `after`), so nobody waits on Brevo or
 * a push service. Everything else stays in Notifications and the weekly digest.
 */

export type NotifyKind = "reply" | "answer" | "request" | "mention" | "interest" | "message" | "feedback" | "paper" | "event";
export type Notification = { kind: NotifyKind; title: string; body?: string; href: string };

// One e-mail per person and place in ten minutes: a busy thread is not ten e-mails.
const recent = new Map<string, number>();
const QUIET_MS = 10 * 60 * 1000;

export async function notifyNow(to: (string | null | undefined)[], n: Notification, from?: string): Promise<void> {
  const ids = [...new Set(to.filter((x): x is string => !!x && x !== from))].slice(0, 200);
  if (!ids.length) return;
  let origin = process.env.SCICOLLAB_SITE_URL ?? "";
  if (!origin) {
    try { const h = await headers(); origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`; } catch { origin = "https://scicollab.net"; }
  }
  const url = n.href.startsWith("http") ? n.href : `${origin}${n.href}`;
  const run = () => deliver(ids, n, url, origin).catch(() => {});
  try { after(run); } catch { await run(); }
}

async function deliver(ids: string[], n: Notification, url: string, origin: string) {
  const db = createAdminClient();
  const [{ data: people }, { data: subs }] = await Promise.all([
    db.from("profiles").select("id, display_name, notify_email, notify_push").in("id", ids),
    pushConfigured() ? db.from("push_subscriptions").select("endpoint, user_id, p256dh, auth").in("user_id", ids) : Promise.resolve({ data: [] as any[] }),
  ]);
  for (const p of (people ?? []) as { id: string; display_name: string; notify_email?: boolean; notify_push?: boolean }[]) {
    if (p.notify_push !== false) {
      for (const s of (subs ?? []).filter((x: any) => x.user_id === p.id)) {
        const r = await sendPush(s, { title: n.title, body: n.body ?? "", url });
        if (r === "gone") await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      }
    }
    if (p.notify_email === false || !isConfigured() || !memberMailConfigured()) continue;
    const key = `${p.id}|${n.href}`;
    if (Date.now() - (recent.get(key) ?? 0) < QUIET_MS) continue;
    recent.set(key, Date.now());
    const { data: auth } = await db.auth.admin.getUserById(p.id);
    const email = auth?.user?.email;
    if (!email) continue;
    await sendToMember({ email, name: p.display_name }, `SciCollab: ${n.title}`,
      `${n.title}\n\n${n.body ? `${n.body}\n\n` : ""}Open it: ${url}\n\n` +
      `You get this e-mail because "E-mail me right away" is on. Switch it off in Settings: ${origin}/settings#notifications\n`);
  }
}

/** The name to put in a notification ("Maja Lindqvist replied …"). */
export async function nameOf(supabase: { from: (t: string) => any }, id: string): Promise<string> {
  const { data } = await supabase.from("profiles").select("display_name").eq("id", id).maybeSingle();
  return data?.display_name ?? "Someone";
}
export const quote = (t: string | null | undefined, n = 80) => { const s = String(t ?? "").trim(); return `“${s.length > n ? s.slice(0, n - 1) + "…" : s}”`; };
export const snippet = (t: string | null | undefined, n = 200) => { const s = String(t ?? "").replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
