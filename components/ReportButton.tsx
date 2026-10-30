"use client";

import { useState, useTransition } from "react";
import { reportContent } from "@/app/actions/reports";

const REASONS = [
  ["spam", "Spam or advertising"],
  ["abuse", "Harassment or abuse"],
  ["misconduct", "Possible research misconduct"],
  ["personal-data", "Personal or patient data"],
  ["other", "Something else"],
] as const;

/** "Report" with a small form: a reason and an optional note for the moderation team. */
export default function ReportButton({ kind, targetId, label = "Report" }: { kind: string; targetId: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"" | "sent" | string>("");
  const [pending, start] = useTransition();
  const small = { background: "transparent", border: 0, padding: 0, font: "400 12px/1.4 var(--sans)", color: "var(--mute)", cursor: "pointer" } as const;

  if (state === "sent") return <span role="status" style={{ ...small, cursor: "default" }}>Reported. Thank you, the moderation team will look at it.</span>;
  if (!open) return <button type="button" style={small} onClick={() => setOpen(true)}>{label}</button>;
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); const f = new FormData(e.currentTarget); start(async () => { const r = await reportContent(kind, targetId, f); setState("error" in r ? r.error : "sent"); }); }}
      className="sc-soft"
      style={{ display: "flex", flexDirection: "column", gap: 8, padding: 10, border: "1px solid var(--rule)", background: "var(--surface)", maxWidth: 360, marginTop: 6 }}
    >
      <label style={{ font: "600 12.5px/1.3 var(--sans)" }} htmlFor={`rp-${targetId}`}>Why are you reporting this?</label>
      <select id={`rp-${targetId}`} name="reason" required defaultValue="" style={{ height: 32, border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink)", font: "400 13px/1 var(--sans)", padding: "0 8px" }}>
        <option value="" disabled>Choose a reason</option>
        {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
      <textarea name="note" rows={2} maxLength={1000} placeholder="Anything the team should know (optional)" aria-label="Note for the moderation team"
        style={{ border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink)", font: "400 13px/1.4 var(--sans)", padding: 8 }} />
      {state && <span role="alert" style={{ font: "400 12px/1.4 var(--sans)", color: "var(--err)" }}>{state}</span>}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="submit" disabled={pending} style={{ height: 30, padding: "0 12px", border: "1px solid var(--err)", background: "transparent", color: "var(--err)", font: "500 12px/1 var(--sans)", cursor: "pointer" }}>{pending ? "Sending…" : "Send report"}</button>
        <button type="button" onClick={() => setOpen(false)} style={{ ...small, padding: "0 6px" }}>Cancel</button>
      </div>
    </form>
  );
}
