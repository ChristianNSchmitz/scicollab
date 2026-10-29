"use client";

import { useState } from "react";
import { btn } from "@/components/ui";

/** Copies an invitation to paste into an e-mail; SciCollab sends nothing itself. */
export default function InviteButton({ text, subject }: { text: string; subject: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button
        type="button"
        style={{ ...btn, height: 30, padding: "0 10px" }}
        onClick={() => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {})}
      >
        {copied ? "Copied ✓" : "Copy invitation"}
      </button>
      <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`} style={{ ...btn, height: 30, padding: "0 10px" }}>E-mail</a>
    </span>
  );
}
