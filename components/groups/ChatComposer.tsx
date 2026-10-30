"use client";

import { useRef } from "react";

/** The group chat's input: Enter sends, Shift+Enter makes a new line. */
export default function ChatComposer({ action }: { action: (form: FormData) => void | Promise<void> }) {
  const form = useRef<HTMLFormElement>(null);
  return (
    <form ref={form} action={action} style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: 12, borderTop: "1px solid var(--rule)" }}>
      <label htmlFor="gchat-body" style={{ position: "absolute", left: -9999 }}>Message to the group</label>
      <textarea
        id="gchat-body" name="body" required maxLength={4000} rows={2} placeholder="Message to the group… (Enter sends, Shift+Enter for a new line)"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (e.currentTarget.value.trim()) form.current?.requestSubmit(); }
        }}
        style={{ flex: 1, minHeight: 44, resize: "vertical", padding: "9px 12px", border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink)", font: "400 13.5px/1.5 var(--sans)" }}
      />
      <button type="submit" className="sc-pill" style={{ height: 36, padding: "0 16px", border: "1px solid var(--ink)", background: "var(--ink)", color: "var(--bg)", font: "600 13px/1 var(--sans)", cursor: "pointer" }}>Send</button>
    </form>
  );
}
