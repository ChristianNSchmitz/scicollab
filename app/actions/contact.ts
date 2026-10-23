"use server";

import { headers } from "next/headers";
import { verifyCaptcha, captchaConfigured } from "@/lib/captcha";
import { mailConfigured, sendMail } from "@/lib/mail";
import { TOPICS, type ContactResult } from "@/lib/contact";

/**
 * The public contact form.
 *
 * Order of checks, cheapest first: honeypot → rate limit → fields → captcha
 * → send. Nothing is stored: the message goes out by e-mail and is gone.
 *
 * Without an e-mail service configured (a laptop, a preview) the message is
 * checked exactly as in production and then written to the server log, and
 * the visitor is told it was not delivered — never a false "sent".
 */

/* Five messages per address per ten minutes. In memory: per server instance,
   which is enough to stop a burst; the captcha does the real work. */
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();

function limited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= LIMIT) { hits.set(ip, recent); return true; }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5_000) hits.clear(); // never let the table grow without bound
  return false;
}

const oneLine = (s: string) => s.replace(/[\r\n\t]+/g, " ").trim();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export async function sendContact(form: FormData): Promise<ContactResult> {
  // A field people never see. Bots fill every input; a filled one is a bot.
  // Answer as if it worked, so the bot learns nothing.
  if (String(form.get("website") ?? "") !== "") return { ok: true, delivered: false };

  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "local";
  if (limited(ip)) return { ok: false, error: "Too many messages from this connection. Please try again in a few minutes." };

  const name = oneLine(String(form.get("name") ?? "")).slice(0, 120);
  const email = oneLine(String(form.get("email") ?? "")).slice(0, 200);
  const organisation = oneLine(String(form.get("organisation") ?? "")).slice(0, 160);
  const topic = String(form.get("topic") ?? "");
  const message = String(form.get("message") ?? "").trim();

  if (name.length < 2) return { ok: false, field: "name", error: "Please give your name." };
  if (!EMAIL.test(email)) return { ok: false, field: "email", error: "That e-mail address does not look complete." };
  if (!(TOPICS as readonly string[]).includes(topic)) return { ok: false, field: "topic", error: "Please choose what your message is about." };
  if (message.length < 10) return { ok: false, field: "message", error: "Please write a little more — at least a sentence." };
  if (message.length > 5_000) return { ok: false, field: "message", error: "Please keep the message under 5,000 characters." };
  if (form.get("consent") !== "on") return { ok: false, field: "consent", error: "Please confirm we may use your details to answer you." };

  if (!captchaConfigured()) return { ok: false, error: "The contact form is not available yet. Please try again later." };
  if (!(await verifyCaptcha(form.get("altcha")))) {
    return { ok: false, field: "captcha", error: "The anti-robot check did not pass. Tick the box again, then send." };
  }

  const text = [
    `From:          ${name} <${email}>`,
    `Organisation:  ${organisation || "—"}`,
    `About:         ${topic}`,
    `Sent:          ${new Date().toISOString()}`,
    "",
    message,
    "",
    "—",
    "Sent from the contact form on the SciCollab website. Reply to this e-mail to answer the sender directly.",
  ].join("\n");

  if (!mailConfigured()) {
    // Development and previews: show the message where the developer looks.
    console.info(`\n[contact] NOT SENT — no e-mail service configured (see README → Contact form)\n${text}\n`);
    return { ok: true, delivered: false };
  }

  const sent = await sendMail({
    subject: `[SciCollab contact] ${topic} — ${name}`,
    text,
    replyTo: { email, name },
  });
  if (!sent.ok) {
    console.error(`[contact] delivery failed: ${sent.error}`);
    return { ok: false, error: "Your message could not be delivered just now. Please try again in a moment." };
  }
  return { ok: true, delivered: true };
}
