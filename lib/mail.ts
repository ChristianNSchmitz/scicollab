/**
 * Outgoing e-mail, through Brevo's HTTP API: the contact form (to the team)
 * and the weekly notification digest (to members, lib/social/digest.ts).
 *
 * Why Brevo: a French company (formerly Sendinblue) with EU data processing,
 * a free tier of 300 e-mails a day, and a plain HTTPS API — no extra package.
 *
 * Needs three settings (in .env.local on a laptop, or the hosting provider's
 * environment variables in production):
 *   BREVO_API_KEY       the API key from Brevo → SMTP & API → API keys
 *   CONTACT_FROM_EMAIL  a sender address verified in Brevo
 *   CONTACT_TO_EMAIL    who receives the messages
 * The recipient is deliberately not written in the code: this repository is
 * mirrored publicly, and a personal address in it would be harvested.
 *
 * Without them nothing is sent: the caller is told so and can say it plainly.
 */

export type Mail = {
  subject: string;
  text: string;
  replyTo: { email: string; name: string };
};

export function mailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.CONTACT_FROM_EMAIL && process.env.CONTACT_TO_EMAIL);
}

export async function sendMail(mail: Mail): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!mailConfigured()) return { ok: false, error: "not-configured" };

  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY!,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: "SciCollab website", email: process.env.CONTACT_FROM_EMAIL },
      to: process.env.CONTACT_TO_EMAIL!.split(",").map((email) => ({ email: email.trim() })),
      replyTo: mail.replyTo,
      subject: mail.subject,
      textContent: mail.text,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!res) return { ok: false, error: "unreachable" };
  if (!res.ok) return { ok: false, error: `brevo-${res.status}` };
  return { ok: true };
}

/** Mail to one member, from the verified sender. Needs BREVO_API_KEY and CONTACT_FROM_EMAIL. */
export function memberMailConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY && process.env.CONTACT_FROM_EMAIL);
}

export async function sendToMember(to: { email: string; name: string }, subject: string, text: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!memberMailConfigured()) return { ok: false, error: "not-configured" };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": process.env.BREVO_API_KEY!, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: "SciCollab", email: process.env.CONTACT_FROM_EMAIL },
      to: [{ email: to.email, name: to.name }],
      subject,
      textContent: text,
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res) return { ok: false, error: "unreachable" };
  if (!res.ok) return { ok: false, error: `brevo-${res.status}` };
  return { ok: true };
}
