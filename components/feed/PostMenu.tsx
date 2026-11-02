"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setSaved } from "@/app/actions/post-interactions";
import { mute } from "@/app/actions/feed";
import ReportButton from "@/components/ReportButton";
import { popover, menuItem } from "./popover";

/** The "…" on a post: save it, copy its link, take it or its topic or author out of your feed, report it. */
export default function PostMenu({ postId, saved: initial, own, authorId, authorName, room }: {
  postId: string; saved: boolean; own: boolean;
  /** For "Mute person" and "Mute #topic"; left out where muting makes no sense (the post page). */
  authorId?: string; authorName?: string; room?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSavedState] = useState(initial);
  const [note, setNote] = useState("");
  const [, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button type="button" aria-label="More options for this post" aria-expanded={open} aria-haspopup="menu" onClick={() => { setOpen(!open); setNote(""); }}
        style={{ width: 30, height: 30, borderRadius: 999, border: 0, background: open ? "var(--rule)" : "transparent", color: "var(--mute)", font: "700 16px/1 var(--sans)", cursor: "pointer" }}>
        ···
      </button>
      {open && (
        <div role="menu" style={{ ...popover, right: 0, top: 34 }}>
          <button type="button" role="menuitem" className="sc-menu-item" style={menuItem} onClick={() => {
            const next = !saved; setSavedState(next); setNote(next ? "Saved. Find it under Saved posts in your menu." : "Removed from your saved posts.");
            start(async () => { const r = await setSaved(postId, next); if ("error" in r) { setSavedState(!next); setNote(r.error); } });
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>{saved ? "Unsave" : "Save for later"}
          </button>
          <button type="button" role="menuitem" className="sc-menu-item" style={menuItem} onClick={async () => {
            try { await navigator.clipboard.writeText(`${window.location.origin}/posts/${postId}`); setNote("Link copied."); } catch { setNote(`${window.location.origin}/posts/${postId}`); }
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>Copy link to post
          </button>
          {!own && authorId && (
            <>
              <div role="separator" style={{ height: 1, background: "var(--rule)", margin: "4px 6px" }} />
              {([
                ["post", postId, "Not interested", "Hidden from your feed."],
                ...(room ? [["room", room, `Mute #${room}`, `#${room} is muted in your feed.`]] : []),
                ["person", authorId, `Mute ${authorName ?? "this person"}`, `${authorName ?? "This person"} is muted in your feed.`],
              ] as [("post" | "room" | "person"), string, string, string][]).map(([kind, target, label, done]) => (
                <button key={kind} type="button" role="menuitem" className="sc-menu-item" style={menuItem} onClick={() => {
                  setNote("…");
                  start(async () => {
                    const r = await mute(kind, target);
                    if ("error" in r) { setNote(r.error); return; }
                    setNote(`${done} Undo it under Filter.`);
                    router.refresh();
                  });
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">{kind === "post" ? <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6l12.8 12.8" /></> : <><path d="M11 5 6 9H3v6h3l5 4z" /><path d="m22 9-6 6M16 9l6 6" /></>}</svg>{label}
                </button>
              ))}
            </>
          )}
          {!own && <div style={{ ...menuItem, cursor: "default", display: "block" }}><ReportButton kind="post" targetId={postId} label="Report this post" /></div>}
          {note && <div role="status" style={{ padding: "6px 10px 4px", font: "400 12px/1.5 var(--sans)", color: "var(--mute)", overflowWrap: "anywhere" }}>{note}</div>}
        </div>
      )}
    </div>
  );
}
