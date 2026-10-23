"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { sendContact } from "@/app/actions/contact";
import { TOPICS, type ContactField, type ContactResult } from "@/lib/contact";
import Captcha from "@/components/Captcha";
import { field, fieldLabel, mono } from "@/components/ui";

export default function ContactForm({ initialTopic }: { initialTopic?: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const captchaRef = useRef<HTMLElement & { reset?: () => void }>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ContactResult | null>(null);

  const start = (TOPICS as readonly string[]).includes(initialTopic ?? "") ? initialTopic : TOPICS[0];
  const bad = (f: ContactField) => result && !result.ok && result.field === f;
  const border = (f: ContactField) => (bad(f) ? { borderColor: "var(--err)" } : null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const res = await sendContact(new FormData(e.currentTarget)).catch(
      (): ContactResult => ({ ok: false, error: "Something went wrong on our side. Please try again." })
    );
    setBusy(false);
    setResult(res);
    // A captcha answer works once: whatever happened, the next attempt needs a new one.
    captchaRef.current?.reset?.();
    if (res.ok) formRef.current?.reset();
  }

  if (result?.ok) {
    return (
      <div role="status" style={{ border: `1px solid ${result.delivered ? "var(--ok)" : "var(--flag)"}`, background: "var(--surface)", padding: "18px 20px" }}>
        <div style={{ font: mono(10, 700), letterSpacing: ".1em", color: result.delivered ? "var(--ok)" : "#8A6A00", marginBottom: 8 }}>
          {result.delivered ? "MESSAGE SENT" : "CHECKED — NOT SENT (PREVIEW)"}
        </div>
        <p style={{ font: "400 13.5px/1.6 var(--sans)", margin: 0 }}>
          {result.delivered
            ? "Thank you. A person from the team will answer you by e-mail."
            : "Your message passed every check, but this copy of the site has no e-mail service connected, so it was written to the server log instead of being sent. On the live site it would have gone to the team."}
        </p>
        <button type="button" onClick={() => setResult(null)} style={{ ...ghost, marginTop: 14 }}>
          Write another message
        </button>
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={submit} noValidate style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <label style={lab}>
          <span style={lbl}>Name</span>
          <input name="name" autoComplete="name" required maxLength={120} style={{ ...field, ...border("name") }} />
        </label>
        <label style={lab}>
          <span style={lbl}>E-mail</span>
          <input name="email" type="email" autoComplete="email" required maxLength={200} style={{ ...field, ...border("email") }} />
        </label>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        <label style={lab}>
          <span style={lbl}>Organisation <span style={{ textTransform: "none", letterSpacing: 0 }}>(optional)</span></span>
          <input name="organisation" autoComplete="organization" maxLength={160} style={field} />
        </label>
        <label style={lab}>
          <span style={lbl}>About</span>
          <select name="topic" defaultValue={start} style={{ ...field, ...border("topic") }}>
            {TOPICS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>

      <label style={lab}>
        <span style={lbl}>Message</span>
        <textarea name="message" required rows={7} maxLength={5000}
          style={{ ...field, height: "auto", padding: "10px", font: "400 13.5px/1.55 var(--sans)", resize: "vertical", ...border("message") }} />
      </label>

      {/* Honeypot: hidden from people and from screen readers; bots fill it in. */}
      <div aria-hidden="true" style={{ position: "absolute", left: -10_000, width: 1, height: 1, overflow: "hidden" }}>
        <label>Website <input name="website" tabIndex={-1} autoComplete="off" /></label>
      </div>

      <label style={{ display: "flex", gap: 10, alignItems: "flex-start", font: "400 12.5px/1.55 var(--sans)", color: bad("consent") ? "var(--err)" : "var(--ink)" }}>
        <input type="checkbox" name="consent" required style={{ marginTop: 3 }} />
        <span>
          I agree that SciCollab uses my name and e-mail address only to answer this message.
          It is sent to the team by e-mail and not stored on the website.
        </span>
      </label>

      <div style={bad("captcha") ? { outline: "1px solid var(--err)" } : undefined}>
        <Captcha ref={captchaRef} />
      </div>

      {result && !result.ok && (
        <p role="alert" style={{ font: "400 12px/1.5 var(--mono)", color: "var(--err)", border: "1px solid var(--err)", padding: "8px 10px", margin: 0 }}>
          {result.error}
        </p>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
        <button type="submit" disabled={busy} style={primary}>{busy ? "Sending…" : "Send message"}</button>
        <span style={{ font: mono(11, 400, 1.5), color: "var(--mute)" }}>
          See also the <Link href="/faq">questions people ask</Link>.
        </span>
      </div>
    </form>
  );
}

const lab: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const primary: React.CSSProperties = {
  height: 42, padding: "0 22px", background: "var(--signal)", color: "#fff",
  border: "1px solid var(--signal)", font: mono(13, 500), cursor: "pointer",
};
const ghost: React.CSSProperties = {
  height: 34, padding: "0 14px", background: "transparent", color: "var(--ink)",
  border: "1px solid var(--ink)", font: mono(12, 500), cursor: "pointer",
};
const lbl: React.CSSProperties = { ...fieldLabel, marginBottom: 0 };
