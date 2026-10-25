import type { CSSProperties } from "react";

/**
 * User-written text with one piece of structure: fenced code blocks.
 *
 * Researchers paste code into questions about their analysis — that is what
 * the Stats & code room is for — and in a proportional font with collapsed
 * indentation it stops being readable, and in Python stops being correct.
 * Everything outside a ``` fence renders exactly as before (plain text,
 * line breaks kept). Nothing is interpreted as HTML: the text stays text.
 */

type Part = { code: false; text: string } | { code: true; lang: string; text: string };

const FENCE = /```([\w+-]*)[^\S\n]*\n([\s\S]*?)\n?```/g;

export function splitFences(body: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of body.matchAll(FENCE)) {
    const at = m.index ?? 0;
    if (at > last) parts.push({ code: false, text: body.slice(last, at) });
    parts.push({ code: true, lang: m[1] ?? "", text: m[2] ?? "" });
    last = at + m[0].length;
  }
  if (last < body.length) parts.push({ code: false, text: body.slice(last) });
  return parts
    .map((p) => (p.code ? p : { ...p, text: p.text.replace(/^\n+|\n+$/g, "") }))
    .filter((p) => p.code || p.text.length > 0);
}

export default function RichText({ body, style, className = "sc-prose" }: {
  body: string; style?: CSSProperties; className?: string;
}) {
  const parts = splitFences(body ?? "");
  const text: CSSProperties = { font: "400 14px/1.7 var(--sans)", margin: 0, whiteSpace: "pre-wrap", ...style };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {parts.map((p, i) =>
        p.code ? (
          <pre
            key={i}
            aria-label={p.lang ? `${p.lang} code` : "code"}
            style={{
              margin: 0, padding: "10px 12px", overflowX: "auto",
              background: "var(--bg)", border: "1px solid var(--rule)",
              font: "400 12.5px/1.55 var(--mono)", color: "var(--ink)", whiteSpace: "pre",
            }}
          >
            <code>{p.text}</code>
          </pre>
        ) : (
          <p key={i} className={className} style={text}>{p.text}</p>
        )
      )}
    </div>
  );
}
