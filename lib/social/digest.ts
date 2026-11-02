import type { SupabaseClient } from "@supabase/supabase-js";
import { isConfigured } from "@/lib/mode";
import { loadNotices, type Notice } from "@/lib/social/notifications";
import { peopleById } from "@/lib/people";
import { sendToMember, memberMailConfigured } from "@/lib/mail";
import { forYou, type ForYou } from "@/lib/social/for-you";

type Client = SupabaseClient<any, any, any>;

/**
 * The weekly e-mail: what happened to you in the last seven days, grouped,
 * with one link each. Sent only when something happened, only to people who
 * left "weekly summary" on in Settings, and as plain text: no tracking
 * pixels, no images.
 */
export function digestText(name: string, notices: Notice[], names: Map<string, string>, origin: string, waiting?: ForYou): string {
  const groups: [string, Notice[]][] = [
    ["Messages", notices.filter((n) => n.kind === "message")],
    ["Mentions", notices.filter((n) => n.kind === "mention")],
    ["Replies and answers", notices.filter((n) => n.kind === "reply" || n.kind === "answer")],
    ["Reactions", notices.filter((n) => n.kind === "reaction")],
    ["New followers", notices.filter((n) => n.kind === "follow")],
    ["Data requests", notices.filter((n) => n.kind === "data request")],
    ["Requests to join your groups", notices.filter((n) => n.kind === "join request")],
    ["Feedback", notices.filter((n) => n.kind === "feedback")],
    ["Your calls for collaborators", notices.filter((n) => n.kind === "call")],
    ["Reposts", notices.filter((n) => n.kind === "repost")],
  ];
  const line = (n: Notice) => `- ${n.who ? names.get(n.who) ?? "Someone" : "Someone"} ${n.text}\n  ${origin}${n.href}`;
  const body = groups.filter(([, xs]) => xs.length)
    .map(([title, xs]) => `${title} (${xs.length})\n${xs.slice(0, 8).map(line).join("\n")}${xs.length > 8 ? `\n  and ${xs.length - 8} more` : ""}`)
    .join("\n\n");
  // Where your expertise is wanted: feedback asked of you, open questions that match what you know.
  const wanted = [
    ...(waiting?.feedback ?? []).map((f) => `- Feedback asked of you: “${f.title}”${f.deadline ? `, by ${f.deadline}` : ""}\n  ${origin}/posts/${f.id}`),
    ...(waiting?.questions ?? []).map((q) => `- Unanswered, matches “${q.match}”: “${q.title}”\n  ${origin}/questions/${q.id}`),
  ];
  const wantedText = wanted.length ? `\n\nWhere your expertise is wanted (${wanted.length})\n${wanted.join("\n")}` : "";
  return `Hello ${name.replace(/\.ex$/, "")},\n\nThis is what happened on SciCollab in the last week.\n\n${body}${wantedText}\n\nAll notifications: ${origin}/notifications\n\nYou get this e-mail because the weekly summary is on. Switch it off in Settings: ${origin}/settings#privacy\n`;
}

export async function sendDigests(db: Client, origin: string, opts: { dry: boolean; limit: number }) {
  const { data: people } = await db.from("profiles").select("id, display_name, weekly_digest").eq("weekly_digest", true).limit(opts.limit);
  const result = { considered: people?.length ?? 0, withNews: 0, sent: 0, failed: 0, skipped: 0 };
  const canSend = isConfigured() && memberMailConfigured() && !opts.dry;

  for (const p of (people ?? []) as { id: string; display_name: string }[]) {
    const [notices, waiting] = await Promise.all([loadNotices(db, p.id, 7), forYou(db, p.id, { days: 30, limit: 3 })]);
    if (!notices.length && !waiting.feedback.length && !waiting.questions.length) continue;
    result.withNews++;
    if (!canSend) { result.skipped++; continue; }
    const { data: auth } = await db.auth.admin.getUserById(p.id);
    const email = auth?.user?.email;
    if (!email) { result.skipped++; continue; }
    const names = new Map([...(await peopleById(db, notices.map((n) => n.who)))].map(([id, x]) => [id, x.display_name]));
    const sent = await sendToMember(
      { email, name: p.display_name }, (() => { const n = notices.length + waiting.feedback.length + waiting.questions.length; return `SciCollab: ${n} thing${n > 1 ? "s" : ""} this week`; })(),
      digestText(p.display_name, notices, names, origin, waiting),
    );
    if (sent.ok) result.sent++; else result.failed++;
  }
  return result;
}
