import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { loadNotices, type Notice } from "@/lib/social/notifications";
import { peopleById } from "@/lib/people";
import { sendToMember, memberMailConfigured } from "@/lib/mail";

type Client = SupabaseClient<any, any, any>;

/**
 * The weekly e-mail: what happened to you in the last seven days, grouped,
 * with one link each. Sent only when something happened, only to people who
 * left "weekly summary" on in Settings, and as plain text: no tracking
 * pixels, no images.
 */
export function digestText(name: string, notices: Notice[], names: Map<string, string>, origin: string): string {
  const groups: [string, Notice[]][] = [
    ["Messages", notices.filter((n) => n.kind === "message")],
    ["Mentions", notices.filter((n) => n.kind === "mention")],
    ["Replies and answers", notices.filter((n) => n.kind === "reply" || n.kind === "answer")],
    ["Reactions", notices.filter((n) => n.kind === "reaction")],
    ["New followers", notices.filter((n) => n.kind === "follow")],
    ["Data requests", notices.filter((n) => n.kind === "data request")],
    ["Requests to join your groups", notices.filter((n) => n.kind === "join request")],
  ];
  const line = (n: Notice) => `- ${n.who ? names.get(n.who) ?? "Someone" : "Someone"} ${n.text}\n  ${origin}${n.href}`;
  const body = groups.filter(([, xs]) => xs.length)
    .map(([title, xs]) => `${title} (${xs.length})\n${xs.slice(0, 8).map(line).join("\n")}${xs.length > 8 ? `\n  and ${xs.length - 8} more` : ""}`)
    .join("\n\n");
  return `Hello ${name.replace(/\.ex$/, "")},\n\nThis is what happened on SciCollab in the last week.\n\n${body}\n\nAll notifications: ${origin}/notifications\n\nYou get this e-mail because the weekly summary is on. Switch it off in Settings: ${origin}/settings#privacy\n`;
}

export async function sendDigests(db: Client, origin: string, opts: { dry: boolean; limit: number }) {
  const { data: people } = await db.from("profiles").select("id, display_name, weekly_digest").eq("weekly_digest", true).limit(opts.limit);
  const result = { considered: people?.length ?? 0, withNews: 0, sent: 0, failed: 0, skipped: 0 };
  const canSend = isConfigured() && memberMailConfigured() && !opts.dry;

  for (const p of (people ?? []) as { id: string; display_name: string }[]) {
    const notices = await loadNotices(db, p.id, 7);
    if (!notices.length) continue;
    result.withNews++;
    if (!canSend) { result.skipped++; continue; }
    const { data: auth } = await db.auth.admin.getUserById(p.id);
    const email = auth?.user?.email;
    if (!email) { result.skipped++; continue; }
    const names = new Map([...(await peopleById(db, notices.map((n) => n.who)))].map(([id, x]) => [id, x.display_name]));
    const sent = await sendToMember(
      { email, name: p.display_name }, `SciCollab: ${notices.length} thing${notices.length > 1 ? "s" : ""} this week`,
      digestText(p.display_name, notices, names, origin),
    );
    if (sent.ok) result.sent++; else result.failed++;
  }
  return result;
}
