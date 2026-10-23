/** Shared between the contact form (browser) and its server action. */
export const TOPICS = ["General question", "A pilot for my lab or institution", "Press", "Something else"] as const;

export type ContactField = "name" | "email" | "topic" | "message" | "consent" | "captcha";

export type ContactResult =
  | { ok: true; delivered: boolean }
  | { ok: false; error: string; field?: ContactField };
