"use client";

import { useState } from "react";

/** A link shown in a field with a copy button, for invitations. */
export default function CopyLink({ url, compact = false }: { url: string; compact?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = () => navigator.clipboard?.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  const button = (
    <button type="button" onClick={copy} style={{ height: 28, padding: "0 10px", border: "1px solid var(--ink)", background: "transparent", color: "var(--ink)", font: "500 12px/1 var(--sans)", cursor: "pointer", whiteSpace: "nowrap" }}>
      {copied ? "Copied ✓" : "Copy link"}
    </button>
  );
  if (compact) return button;
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <input readOnly value={url} aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()}
        style={{ flex: 1, minWidth: 0, height: 28, padding: "0 8px", border: "1px solid var(--rule)", background: "var(--bg)", color: "var(--ink)", font: "400 12px/1 var(--code, var(--mono))" }} />
      {button}
    </div>
  );
}
