"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { postStory, deleteStory, markStoriesSeen } from "@/app/actions/stories";
import type { StoryAuthor } from "@/lib/stories";

const COLOURS = ["#1B4FA0", "#0B7A4B", "#B33600", "#6B3FA0", "#0D0D0D", "#8A5A00"];
const SHOW_MS = 6000;
const EDGE = 1440;

const ago = (iso: string) => {
  const m = Math.max(1, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 60 ? `${m} min` : `${Math.round(m / 60)} h`;
};
const first = (name: string) => name.split(/\s+/)[0]?.replace(/\.ex$/, "") ?? name;

/** Scale a photo to at most 1440 px on the long edge, as JPEG. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k); canvas.height = Math.round(bitmap.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("unreadable"))), "image/jpeg", 0.84));
  return new File([blob], "story.jpg", { type: "image/jpeg" });
}

/**
 * The row of stories above the feed, as on LinkedIn: a ring around a person
 * means something new from them; yours comes first, with + to add one.
 */
export default function StoryBar({ authors, me }: { authors: StoryAuthor[]; me: { id: string; name: string; avatar: string | null } }) {
  const [open, setOpen] = useState<number | null>(null);
  const [composing, setComposing] = useState(false);
  const mine = authors.find((a) => a.mine);
  const others = authors.filter((a) => !a.mine);
  const ordered = mine ? [mine, ...others] : others;

  return (
    <div className="sc-stories" role="region" aria-label="Stories">
      <div className="sc-stories-row">
        {/* Your own: open them if there are some, + adds one. */}
        <div className="sc-story-item">
          <button type="button" className={`sc-story-ring ${mine ? "is-mine" : "is-empty"}`} onClick={() => (mine ? setOpen(0) : setComposing(true))}
            aria-label={mine ? "Your story" : "Add a story"}>
            <Avatar name={me.name} url={me.avatar} size={56} />
          </button>
          <button type="button" className="sc-story-add" onClick={() => setComposing(true)} aria-label="Add a story">+</button>
          <span className="sc-story-name">Your story</span>
        </div>
        {others.map((a) => (
          <div key={a.id} className="sc-story-item">
            <button type="button" className={`sc-story-ring ${a.unseen ? "is-new" : "is-seen"}`} onClick={() => setOpen(ordered.indexOf(a))}
              aria-label={`Story by ${a.name}${a.unseen ? ", new" : ""}`}>
              <Avatar name={a.name} url={a.avatar} size={56} />
            </button>
            <span className="sc-story-name">{first(a.name)}</span>
          </div>
        ))}
      </div>
      {open !== null && <Viewer authors={ordered} start={open} onClose={() => setOpen(null)} />}
      {composing && <Composer onClose={() => setComposing(false)} />}
    </div>
  );
}

/** Full-screen viewer: progress bars, tap left or right, hold to pause, arrows and Esc. */
function Viewer({ authors, start, onClose }: { authors: StoryAuthor[]; start: number; onClose: () => void }) {
  const router = useRouter();
  const firstUnseen = (a: StoryAuthor) => Math.max(0, a.stories.findIndex((s) => !s.seen));
  const [ai, setAi] = useState(start);
  const [si, setSi] = useState(() => firstUnseen(authors[start]));
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const seen = useRef(new Set<string>());
  const author = authors[ai];
  const story = author?.stories[si];

  const close = useCallback(() => {
    const ids = [...seen.current];
    if (ids.length) void markStoriesSeen(ids).then(() => router.refresh());
    onClose();
  }, [onClose, router]);
  const next = useCallback(() => {
    if (si + 1 < author.stories.length) { setSi(si + 1); return; }
    if (ai + 1 < authors.length) { setAi(ai + 1); setSi(firstUnseen(authors[ai + 1])); return; }
    close();
  }, [ai, si, author, authors, close]);
  const prev = useCallback(() => {
    if (si > 0) { setSi(si - 1); return; }
    if (ai > 0) { setAi(ai - 1); setSi(Math.max(0, authors[ai - 1].stories.length - 1)); }
  }, [ai, si, authors]);

  useEffect(() => { if (story && !author.mine) seen.current.add(story.id); setProgress(0); }, [story, author]);
  useEffect(() => {
    if (paused || !story) return;
    const t0 = performance.now() - progress * SHOW_MS;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / SHOW_MS);
      setProgress(p);
      if (p >= 1) next(); else raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, story, next]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(); else if (e.key === "ArrowRight") next(); else if (e.key === "ArrowLeft") prev();
      else if (e.key === " ") { e.preventDefault(); setPaused((p) => !p); }
    };
    document.addEventListener("keydown", key);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", key); document.body.style.overflow = overflow; };
  }, [close, next, prev]);

  if (!story) return null;
  return (
    <div className="sc-story-viewer" role="dialog" aria-modal="true" aria-label={`Story by ${author.name}`} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="sc-story-card" style={{ background: story.kind === "text" ? story.colour : "#000" }}
        onPointerDown={() => setPaused(true)} onPointerUp={() => setPaused(false)} onPointerLeave={() => setPaused(false)}>
        <div className="sc-story-bars" aria-hidden="true">
          {author.stories.map((s, i) => <span key={s.id}><i style={{ width: `${i < si ? 100 : i === si ? progress * 100 : 0}%` }} /></span>)}
        </div>
        <div className="sc-story-head">
          <Avatar name={author.name} url={author.avatar} size={32} />
          <span className="sc-story-who">{author.mine ? "Your story" : author.name}<span> · {ago(story.created_at)}</span></span>
          <button type="button" className="sc-story-x" onClick={close} aria-label="Close">×</button>
        </div>
        {story.kind === "image"
          // eslint-disable-next-line @next/next/no-img-element
          ? <img className="sc-story-img" src={story.src!} alt={story.body || `Story by ${author.name}`} draggable={false} />
          : <p className="sc-story-text">{story.body}</p>}
        {story.kind === "image" && story.body && <p className="sc-story-caption">{story.body}</p>}
        <button type="button" className="sc-story-tap is-left" onClick={prev} aria-label="Previous" />
        <button type="button" className="sc-story-tap is-right" onClick={next} aria-label="Next" />
        {author.mine && (
          <div className="sc-story-foot">
            <span>Seen by {story.views ?? 0}</span>
            <DeleteButton id={story.id} onDone={close} />
          </div>
        )}
      </div>
    </div>
  );
}

function DeleteButton({ id, onDone }: { id: string; onDone: () => void }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" disabled={pending} onPointerDown={(e) => e.stopPropagation()}
      onClick={() => start(async () => { await deleteStory(id); router.refresh(); onDone(); })}>
      {pending ? "…" : "Delete"}
    </button>
  );
}

/** Add a story: a photo with a line, or a few words on a colour. */
function Composer({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [colour, setColour] = useState(COLOURS[0]);
  const [problem, setProblem] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => { if (!file) { setPreview(null); return; } const u = URL.createObjectURL(file); setPreview(u); return () => URL.revokeObjectURL(u); }, [file]);
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === "Escape" && onClose(); document.addEventListener("keydown", k); return () => document.removeEventListener("keydown", k); }, [onClose]);

  const submit = () => start(async () => {
    setProblem("");
    const form = new FormData();
    form.set("body", body); form.set("colour", colour);
    if (mode === "photo") { if (!file) { setProblem("Choose a picture first."); return; } form.set("image", file); }
    const r = await postStory(form);
    if ("error" in r) { setProblem(r.error); return; }
    router.refresh(); onClose();
  });

  return (
    <div className="sc-story-viewer" role="dialog" aria-modal="true" aria-label="Add a story" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="sc-story-compose">
        <div className="sc-story-compose-head">
          <b>Add a story</b><span>Visible for 24 hours to your followers and group mates</span>
          <button type="button" className="sc-story-x" onClick={onClose} aria-label="Close">×</button>
        </div>
        <div className="sc-story-modes" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "photo"} onClick={() => setMode("photo")}>Photo</button>
          <button type="button" role="tab" aria-selected={mode === "text"} onClick={() => setMode("text")}>Text</button>
        </div>
        <div className="sc-story-stage" style={{ background: mode === "text" ? colour : "#111" }}>
          {mode === "photo"
            ? (preview
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={preview} alt="" className="sc-story-img" />
              : <label className="sc-story-pick">Choose a picture<input type="file" accept="image/*" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setFile(await shrink(f)); } catch { setProblem("That picture could not be read."); } } }} /></label>)
            : <p className="sc-story-text">{body || "Your words here"}</p>}
        </div>
        {mode === "text" && (
          <div className="sc-story-colours" role="radiogroup" aria-label="Colour">
            {COLOURS.map((c) => <button key={c} type="button" role="radio" aria-checked={colour === c} aria-label={c} style={{ background: c }} onClick={() => setColour(c)} />)}
          </div>
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={280} rows={2}
          placeholder={mode === "photo" ? "A line about it (optional)" : "What is happening in the lab?"} aria-label="Text" />
        {problem && <p role="alert" className="sc-story-problem">{problem}</p>}
        <div className="sc-story-actions">
          {mode === "photo" && file && <button type="button" onClick={() => setFile(null)}>Other picture</button>}
          <button type="button" className="is-primary" disabled={pending} onClick={submit}>{pending ? "Posting…" : "Share story"}</button>
        </div>
      </div>
    </div>
  );
}
