import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";

/**
 * User-written text with one piece of structure: fenced code blocks.
 *
 * Researchers paste code into questions about their analysis — that is what
 * the Stats & code room is for — and in a proportional font with collapsed
 * indentation it stops being readable, and in Python stops being correct.
 * Everything outside a ``` fence renders exactly as before (plain text,
 * line breaks kept). Nothing is interpreted as HTML: the text stays text.
 * Two exceptions: web addresses become links (opening in a new tab, marked
 * as user content for search engines), and "@Name" of a person the text
 * mentions (stored when it was saved, lib/social/mentions.ts) links to
 * their profile.
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

export type Mention = { id: string; name: string };

/** Plain text with each "@Name" of a mentioned person turned into a link. */
function withMentions(text: string, mentions: Mention[]): ReactNode {
  if (!mentions.length) return text;
  const byName = [...mentions].sort((a, b) => b.name.length - a.name.length);
  const out: ReactNode[] = [];
  let rest = text, k = 0;
  while (rest) {
    const lower = rest.toLowerCase();
    let best: { at: number; m: Mention } | null = null;
    for (const m of byName) {
      const at = lower.indexOf("@" + m.name.toLowerCase());
      if (at >= 0 && (!best || at < best.at)) best = { at, m };
    }
    if (!best) { out.push(rest); break; }
    if (best.at > 0) out.push(rest.slice(0, best.at));
    const len = best.m.name.length + 1;
    out.push(<Link key={k++} href={`/people/${best.m.id}`} style={{ color: "var(--link)", fontWeight: 500 }}>{rest.slice(best.at, best.at + len)}</Link>);
    rest = rest.slice(best.at + len);
  }
  return out;
}

const URL_RE = /\bhttps?:\/\/[^\s<>"']+[^\s<>"'().,;:!?]/gi;

/** Web addresses as links, the text around them with mentions. */
function linkify(text: string, mentions: Mention[]): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<span key={`t${at}`}>{withMentions(text.slice(last, at), mentions)}</span>);
    out.push(
      <a key={`u${at}`} href={m[0]} target="_blank" rel="noopener noreferrer nofollow ugc" style={{ color: "var(--link)", wordBreak: "break-all" }}>
        {m[0].replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}{m[0].replace(/^https?:\/\/(www\.)?/, "").length > 60 ? "…" : ""}
      </a>,
    );
    last = at + m[0].length;
  }
  if (!out.length) return withMentions(text, mentions);
  if (last < text.length) out.push(<span key="end">{withMentions(text.slice(last), mentions)}</span>);
  return out;
}

export default function RichText({ body, style, className = "sc-prose", mentions = [] }: {
  body: string; style?: CSSProperties; className?: string; mentions?: Mention[];
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
          <p key={i} className={className} style={text}>{linkify(p.text, mentions)}</p>
        )
      )}
    </div>
  );
}
