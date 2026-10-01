"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  listConversations, loadThread, sendChat, unreadTotal, findPeople,
  type Conversation, type ChatMessage,
} from "@/app/actions/chat";
import { timeAgo } from "@/lib/format";

/**
 * Chat, docked bottom-right on every screen.
 *
 * It expands over the page rather than taking a permanent column, because the
 * shell already spends its right-hand 320px on the context panel — related
 * artifacts, people and activity — and at 1440 you cannot have both standing.
 * That is the Gmail arrangement, and it is why the dock is a bar until you
 * need it.
 *
 * Near-time, not real-time: it polls while open. Research conversations move
 * in minutes, and websockets are infrastructure to run before there are users.
 */

const mono = (size: number, weight = 400, lh = 1.4) =>
  `${weight} ${size}px/${lh} var(--mono)`;

const POLL_MS = 8000;

export default function ChatDock() {
  const [open, setOpen] = useState(false);
  const [thread, setThread] = useState<string | null>(null);
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [who, setWho] = useState({ name: "", institution: "" });
  const [gated, setGated] = useState(false);
  const [unread, setUnread] = useState(0);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [found, setFound] = useState<{ id: string; name: string; institution: string }[]>([]);
  const scroller = useRef<HTMLDivElement>(null);

  // Badge count, whether the dock is open or shut.
  useEffect(() => {
    let alive = true;
    const tick = () => unreadTotal().then((n) => alive && setUnread(n)).catch(() => {});
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const refreshList = useCallback(() => {
    listConversations().then(setConvos).catch(() => {});
  }, []);

  const refreshThread = useCallback((id: string) => {
    loadThread(id).then((r) => {
      setMessages(r.messages);
      setWho(r.who);
      setGated(r.gated);
    }).catch(() => {});
  }, []);

  useEffect(() => { if (open && !thread) refreshList(); }, [open, thread, refreshList]);

  useEffect(() => {
    if (!open || !thread) return;
    refreshThread(thread);
    const t = setInterval(() => refreshThread(thread), POLL_MS);
    return () => clearInterval(t);
  }, [open, thread, refreshThread]);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages.length, thread]);

  useEffect(() => {
    if (query.trim().length < 2) { setFound([]); return; }
    const t = setTimeout(() => { findPeople(query).then(setFound).catch(() => {}); }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (thread) setThread(null);
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [thread]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!thread || !draft.trim()) return;
    const body = draft;
    setDraft("");
    setError("");
    const res = await sendChat(thread, body);
    if (res.error) { setError(res.error); setDraft(body); return; }
    refreshThread(thread);
  }

  // ── chrome ──────────────────────────────────────────────────────────────
  const shell: React.CSSProperties = {
    position: "fixed", right: 20, bottom: 0, zIndex: 60,
    width: 330, background: "var(--surface)",
    border: "1px solid var(--ink)", borderBottom: 0,
    display: "flex", flexDirection: "column",
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ ...shell, height: 38, flexDirection: "row", alignItems: "center", gap: 9, padding: "0 12px", cursor: "pointer", textAlign: "left" }}
        aria-label="Open chat"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <span style={{ font: mono(12, 500), flex: 1 }}>Chat</span>
        {unread > 0 && (
          <span style={{ font: mono(10, 700), background: "var(--signal)", color: "#fff", padding: "2px 6px" }}>{unread}</span>
        )}
      </button>
    );
  }

  return (
    <div style={{ ...shell, height: 460 }}>
      {/* header */}
      <div style={{ height: 38, flex: "none", display: "flex", alignItems: "center", gap: 8, padding: "0 10px 0 12px", borderBottom: "1px solid var(--rule)" }}>
        {thread && (
          <button onClick={() => { setThread(null); setError(""); refreshList(); }} aria-label="Back to conversations"
            style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--ink)", padding: 2, display: "flex" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m14 7-5 5 5 5" /></svg>
          </button>
        )}
        <span style={{ font: mono(12, 500), flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {thread ? who.name : "Chat"}
        </span>
        {thread && (
          <Link href={`/messages/${thread}`} style={{ font: mono(10), color: "var(--mute)" }} title="Open the full conversation">
            expand
          </Link>
        )}
        <button onClick={() => { setOpen(false); setThread(null); }} aria-label="Close chat"
          style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--mute)", padding: 2, display: "flex" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>
      </div>

      {/* conversation list */}
      {!thread && (
        <>
          <div style={{ padding: 8, borderBottom: "1px solid var(--rule)" }}>
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a researcher…"
              style={{ width: "100%", padding: "7px 9px", border: "1px solid var(--rule)", background: "var(--bg)", font: mono(12), color: "var(--ink)" }}
            />
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {found.map((p) => (
              <button key={p.id} onClick={() => { setThread(p.id); setQuery(""); setFound([]); }}
                style={rowStyle}>
                <span style={{ font: mono(12, 500) }}>{p.name}</span>
                <span style={{ font: mono(10.5), color: "var(--mute)" }}>{p.institution || "—"}</span>
              </button>
            ))}

            {found.length === 0 && convos.length === 0 && (
              <p style={{ padding: 16, font: "400 12px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>
                No conversations yet. Search for someone above, or message an author from a post.
              </p>
            )}

            {found.length === 0 && convos.map((c) => (
              <button key={c.id} onClick={() => setThread(c.id)} style={rowStyle}>
                <span style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ font: mono(12, c.unread ? 700 : 500), flex: 1 }}>{c.name}</span>
                  {c.unread > 0 && (
                    <span style={{ font: mono(9.5, 700), background: "var(--signal)", color: "#fff", padding: "1px 5px" }}>{c.unread}</span>
                  )}
                  <span style={{ font: mono(9.5), color: "var(--mute)" }}>{timeAgo(c.at)}</span>
                </span>
                <span style={{ font: mono(10.5), color: "var(--mute)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>
                  {c.last}
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* thread */}
      {thread && (
        <>
          <div ref={scroller} style={{ flex: 1, overflowY: "auto", padding: 10, display: "flex", flexDirection: "column", gap: 8, background: "var(--bg)" }}>
            {messages.length === 0 && (
              <p style={{ font: "400 11.5px/1.6 var(--sans)", color: "var(--mute)", margin: "8px 0", textAlign: "center" }}>
                No messages yet.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.mine ? "flex-end" : "flex-start", maxWidth: "86%" }}>
                <div style={{ border: "1px solid var(--rule)", background: m.mine ? "var(--surface)" : "var(--surface)", padding: "7px 9px" }}>
                  <p style={{ font: "400 12px/1.55 var(--sans)", margin: 0, whiteSpace: "pre-wrap" }}>{m.body}</p>
                  {m.card && (
                    <Link href={`/methods/${m.card.id}`} style={{ display: "block", marginTop: 6, borderLeft: "3px solid var(--signal)", background: "var(--bg)", padding: "5px 7px", color: "var(--ink)" }}>
                      <span style={{ font: mono(9, 700), letterSpacing: ".08em", color: "var(--signal)" }}>METHOD CARD</span>
                      <span style={{ display: "block", font: mono(11, 500), marginTop: 2 }}>{m.card.code} — {m.card.title}</span>
                    </Link>
                  )}
                </div>
                <div style={{ font: mono(9), color: "var(--mute)", marginTop: 3, textAlign: m.mine ? "right" : "left" }}>
                  {timeAgo(m.at)}
                </div>
              </div>
            ))}
          </div>

          {gated ? (
            <div style={{ flex: "none", borderTop: "1px solid var(--flag)", background: "var(--surface)", padding: "10px 12px" }}>
              <p style={{ font: "400 11.5px/1.55 var(--sans)", margin: "0 0 8px" }}>
                You cannot message strangers yet. Record a method card, ask a question or answer one, and this opens.
              </p>
              <Link href="/methods/new" style={{ font: mono(11, 500), color: "var(--link)" }}>Record a method →</Link>
            </div>
          ) : (
            <form onSubmit={send} style={{ flex: "none", borderTop: "1px solid var(--rule)", padding: 8, display: "flex", flexDirection: "column", gap: 6 }}>
              {error && <p style={{ font: mono(10.5), color: "var(--err)", margin: 0 }}>{error}</p>}
              <div style={{ display: "flex", gap: 6 }}>
                <input
                  value={draft} onChange={(e) => setDraft(e.target.value)}
                  placeholder="Write a message…"
                  style={{ flex: 1, padding: "8px 9px", border: "1px solid var(--rule)", background: "var(--bg)", font: mono(12), color: "var(--ink)" }}
                />
                <button type="submit" disabled={!draft.trim()}
                  style={{ padding: "0 12px", border: "1px solid var(--signal)", background: "var(--signal)", color: "#fff", font: mono(11, 500), cursor: draft.trim() ? "pointer" : "default", opacity: draft.trim() ? 1 : .5 }}>
                  Send
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

const rowStyle: React.CSSProperties = {
  display: "block", width: "100%", textAlign: "left",
  padding: "9px 12px", borderBottom: "1px solid var(--rule)",
  background: "transparent", border: 0, borderBottomWidth: 1,
  borderBottomStyle: "solid", borderBottomColor: "var(--rule)",
  cursor: "pointer", color: "var(--ink)",
};
