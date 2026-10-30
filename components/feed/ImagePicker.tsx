"use client";

import { useEffect, useRef, useState } from "react";
import { btn } from "@/components/ui";

const MAX = 4;
const EDGE = 1600;

/** Scale to at most 1600 px on the long edge as JPEG, so a photo from a phone uploads in a second. */
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const k = Math.min(1, EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * k);
  canvas.height = Math.round(bitmap.height * k);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";                       // transparent PNGs get a white ground, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("unreadable"))), "image/jpeg", 0.82));
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

/**
 * Up to four images for a post. They are scaled in the browser and placed in
 * a hidden file field named "images", so the form submits them like any other
 * field. Each can be removed before posting.
 */
export default function ImagePicker({ resetKey }: { resetKey?: unknown }) {
  const field = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState("");

  useEffect(() => { setFiles([]); }, [resetKey]);

  useEffect(() => {
    if (field.current) {
      const dt = new DataTransfer();
      files.forEach((f) => dt.items.add(f));
      field.current.files = dt.files;
    }
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  async function add(list: FileList | null) {
    if (!list?.length) return;
    setProblem("");
    const room = MAX - files.length;
    const picked = [...list].filter((f) => /^image\/(jpeg|png|webp|heic|heif|gif)$/.test(f.type)).slice(0, room);
    if (list.length > room) setProblem(`At most ${MAX} images per post.`);
    setBusy(true);
    try {
      const scaled = await Promise.all(picked.map(shrink));
      setFiles((cur) => [...cur, ...scaled].slice(0, MAX));
    } catch {
      setProblem("One of the images could not be read. JPEG, PNG and WebP work everywhere.");
    } finally {
      setBusy(false);
      if (picker.current) picker.current.value = "";
    }
  }

  return (
    <div>
      <input ref={field} type="file" name="images" multiple hidden aria-hidden="true" tabIndex={-1} />
      <input ref={picker} id="image-picker" type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple
        onChange={(e) => add(e.target.files)} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <label htmlFor="image-picker" style={{ ...btn, height: 32, padding: "0 12px", opacity: files.length >= MAX ? 0.5 : 1, pointerEvents: files.length >= MAX ? "none" : "auto" }}>
          {busy ? "Preparing…" : files.length ? `Add image (${files.length}/${MAX})` : "Add images"}
        </label>
        {previews.map((src, i) => (
          <span key={src} style={{ position: "relative", display: "inline-flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Image ${i + 1} to post`} style={{ width: 56, height: 56, objectFit: "cover", border: "1px solid var(--rule)" }} />
            <button type="button" onClick={() => setFiles(files.filter((_, k) => k !== i))} aria-label={`Remove image ${i + 1}`}
              style={{ position: "absolute", top: -7, right: -7, width: 20, height: 20, borderRadius: 10, border: "1px solid var(--ink)", background: "var(--surface)", color: "var(--ink)", font: "700 11px/1 var(--mono)", cursor: "pointer" }}>×</button>
          </span>
        ))}
      </div>
      {problem && <p role="alert" style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--err)", margin: "6px 0 0" }}>{problem}</p>}
    </div>
  );
}
