"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { replyInline } from "@/app/actions/posts";
import { useEffect, useRef, useState, useTransition } from "react";
import { repost, undoRepost, sendPost } from "@/app/actions/post-interactions";
import { findPeople } from "@/app/actions/chat";
import { popover, menuItem } from "./popover";


const svg = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;
const IconReply = () => <svg {...svg}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /></svg>;
const IconRepost = () => <svg {...svg}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15" /><path d="M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></svg>;
const IconSend = () => <svg {...svg}><path d="M22 2 11 13" /><path d="M22 2 15 22l-4-9-9-4 20-7z" /></svg>;
const IconPen = () => <svg {...svg}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>;
const IconUndo = () => <svg {...svg}><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>;

type Person = { id: string; name: string; institution: string };

function useOutside(open: boolean, close: () => void) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", down); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", down); document.removeEventListener("keydown", esc); };
  }, [open, close]);
  return box;
}

const field = { width: "100%", border: "1px solid var(--rule)", borderRadius: 12, background: "var(--bg)", color: "var(--ink)", font: "400 13px/1.6 var(--sans)", padding: "8px 10px" } as const;
const primary = { height: 32, padding: "0 14px", border: 0, borderRadius: 999, background: "var(--ink)", color: "var(--bg)", font: "600 12.5px/1 var(--sans)", cursor: "pointer" } as const;

/** Opens the reply field under a post (InlineReply): the Reply button, the "r" key. */
export const REPLY_EVENT = "sc-feed-reply";

/**
 * Reply, Repost and Send along the bottom of a post. Reposting puts the post
 * in your followers' feeds, with a line of your own if you like; sending
 * shares it with one person as a direct message. Posts in a group stay in
 * the group, so they only get Reply.
 */
export default function PostActions({ postId, inGroup, own, reposted: initialReposted, replyInPlace = true }: {
  postId: string; inGroup: boolean; own: boolean; reposted: boolean;
  /** False on the post page, which has its own reply form further down. */
  replyInPlace?: boolean;
}) {
  const [menu, setMenu] = useState<"" | "repost" | "send">("");
  const [reposted, setReposted] = useState(initialReposted);
  const [thoughts, setThoughts] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const close = () => { setMenu(""); setThoughts(null); };
  const box = useOutside(menu !== "", close);

  // Send: search for a person, add a line, send.
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Person[]>([]);
  const [to, setTo] = useState<Person | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (menu !== "send" || to || q.trim().length < 2) { setHits([]); return; }
    const t = window.setTimeout(async () => setHits(await findPeople(q)), 200);
    return () => window.clearTimeout(t);
  }, [q, menu, to]);

  const doRepost = (text: string) => start(async () => {
    const r = await repost(postId, text);
    if ("error" in r) setStatus(r.error); else { setReposted(true); setStatus(text ? "Reposted with your thoughts." : "Reposted to your followers."); close(); }
  });

  return (
    <div ref={box} style={{ position: "relative", display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
      {!replyInPlace ? <Link href={`/posts/${postId}#replies`} className="sc-act"><IconReply />Reply</Link>
        : <button type="button" onClick={() => window.dispatchEvent(new CustomEvent(REPLY_EVENT, { detail: { id: postId, toggle: true } }))} className="sc-act">
          <IconReply />Reply
        </button>}
      {!inGroup && !own && (
        <button type="button" aria-expanded={menu === "repost"} aria-haspopup="menu" onClick={() => { setMenu(menu === "repost" ? "" : "repost"); setThoughts(null); setStatus(""); }}
          className="sc-act" style={reposted ? { color: "var(--ok)" } : undefined}>
          <IconRepost />{reposted ? "Reposted" : "Repost"}
        </button>
      )}
      {!inGroup && (
        <button type="button" aria-expanded={menu === "send"} aria-haspopup="dialog" onClick={() => { setMenu(menu === "send" ? "" : "send"); setStatus(""); setTo(null); setQ(""); setNote(""); }} className="sc-act">
          <IconSend />Send
        </button>
      )}
      {status && <span role="status" style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)", marginLeft: 6 }}>{status}</span>}

      {menu === "repost" && (
        <div role="menu" style={{ ...popover, left: 0, bottom: 38, width: thoughts !== null ? 340 : undefined }}>
          {thoughts === null ? (
            <>
              <button type="button" role="menuitem" className="sc-menu-item" style={menuItem} disabled={pending} onClick={() => doRepost("")}>
                <IconRepost /><span><b style={{ fontWeight: 600 }}>Repost</b><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>Share it with your followers right away</span></span>
              </button>
              <button type="button" role="menuitem" className="sc-menu-item" style={menuItem} onClick={() => setThoughts("")}>
                <IconPen /><span><b style={{ fontWeight: 600 }}>Repost with your thoughts</b><br /><span style={{ color: "var(--mute)", fontSize: 12 }}>Add a line of your own on top</span></span>
              </button>
              {reposted && (
                <button type="button" role="menuitem" className="sc-menu-item" style={{ ...menuItem, color: "var(--err)" }} disabled={pending} onClick={() => start(async () => { await undoRepost(postId); setReposted(false); setStatus("Repost removed."); close(); })}>
                  <IconUndo />Undo repost
                </button>
              )}
            </>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); doRepost(thoughts); }} style={{ display: "flex", flexDirection: "column", gap: 8, padding: 6 }}>
              <label htmlFor={`rp-note-${postId}`} style={{ font: "600 12.5px/1.4 var(--sans)" }}>Your thoughts</label>
              <textarea id={`rp-note-${postId}`} autoFocus rows={3} maxLength={1000} value={thoughts} onChange={(e) => setThoughts(e.target.value)} style={field} placeholder="Why your followers should read this" />
              <div style={{ display: "flex", gap: 8 }}>
                <button type="submit" style={primary} disabled={pending}>Repost</button>
                <button type="button" onClick={close} style={{ ...primary, background: "transparent", color: "var(--ink)", border: "1px solid var(--rule)" }}>Cancel</button>
              </div>
            </form>
          )}
        </div>
      )}

      {menu === "send" && (
        <div role="dialog" aria-label="Send this post" style={{ ...popover, left: 0, bottom: 38, width: 320, padding: 12 }}>
          <form onSubmit={(e) => {
            e.preventDefault(); if (!to) return;
            start(async () => { const r = await sendPost(postId, to.id, note); if ("error" in r) setStatus(r.error); else { setStatus(`Sent to ${to.name}.`); close(); } });
          }} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ font: "600 12.5px/1.4 var(--sans)" }}>Send as a message</div>
            {to ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, font: "400 13px/1.5 var(--sans)" }}>
                <span style={{ flex: 1 }}>To <b style={{ fontWeight: 600 }}>{to.name}</b></span>
                <button type="button" onClick={() => setTo(null)} style={{ border: 0, background: "none", color: "var(--mute)", cursor: "pointer", font: "400 12px/1 var(--sans)", textDecoration: "underline" }}>change</button>
              </div>
            ) : (
              <>
                <label htmlFor={`send-q-${postId}`} style={{ position: "absolute", left: -9999 }}>Search for a person</label>
                <input id={`send-q-${postId}`} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or institution" style={field} autoComplete="off" />
                {hits.map((p) => (
                  <button key={p.id} type="button" style={menuItem} onClick={() => { setTo(p); setHits([]); }}>
                    <span><b style={{ fontWeight: 600 }}>{p.name}</b>{p.institution && <span style={{ color: "var(--mute)" }}> · {p.institution}</span>}</span>
                  </button>
                ))}
              </>
            )}
            <label htmlFor={`send-note-${postId}`} style={{ position: "absolute", left: -9999 }}>Your message</label>
            <textarea id={`send-note-${postId}`} rows={2} maxLength={1500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a message (optional)" style={field} />
            <div><button type="submit" style={{ ...primary, opacity: to ? 1 : .5 }} disabled={!to || pending}>Send</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

/**
 * The reply field right under a post in the feed, so you answer without
 * leaving it. Opened by the Reply button or the "r" key.
 */
export function InlineReply({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [status, setStatus] = useState("");
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent).detail as { id: string; toggle?: boolean } | string;
      const id = typeof d === "string" ? d : d.id;
      if (id !== postId) return;
      setStatus("");
      setOpen((o) => (typeof d !== "string" && d.toggle ? !o : true));
    };
    window.addEventListener(REPLY_EVENT, on);
    return () => window.removeEventListener(REPLY_EVENT, on);
  }, [postId]);
  useEffect(() => { if (open) box.current?.focus(); }, [open]);
  const send = () => {
    if (!reply.trim()) return;
    start(async () => {
      const r = await replyInline(postId, reply);
      if ("error" in r) { setStatus(r.error); return; }
      setReply(""); setOpen(false); setStatus("Reply posted.");
      router.refresh();
    });
  };
  if (!open) return status ? <div role="status" style={{ padding: "0 14px 10px", font: "400 12px/1.5 var(--sans)", color: "var(--mute)" }}>{status}</div> : null;
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: "flex", gap: 8, alignItems: "flex-end", padding: "0 12px 12px 14px" }}>
      <label htmlFor={`reply-${postId}`} style={{ position: "absolute", left: -9999 }}>Your reply</label>
      <textarea id={`reply-${postId}`} ref={box} rows={1} maxLength={5000} value={reply} placeholder="Write a reply…"
        onChange={(e) => { setReply(e.target.value); e.target.style.height = "auto"; e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`; }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
          if (e.key === "Escape") setOpen(false);
        }}
        style={{ ...field, flex: 1, borderRadius: 18, padding: "8px 14px", resize: "none", minHeight: 38 }} />
      <button type="submit" disabled={pending || !reply.trim()} style={{ ...primary, height: 36, opacity: reply.trim() ? 1 : .5 }}>{pending ? "…" : "Reply"}</button>
      {status && <span role="status" style={{ font: "400 12px/1.5 var(--sans)", color: "var(--err)" }}>{status}</span>}
    </form>
  );
}
