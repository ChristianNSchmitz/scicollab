"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";
import { PRESET_COLOURS, PRESET_ICONS, parseAvatar, presetValue } from "@/lib/avatar";
import { clearAvatar, setAvatarPreset, uploadAvatar } from "@/app/actions/profile";
import { btn, btnPrimary, mono } from "@/components/ui";

const SIZE = 256;

/** Centre-crop to a square and scale to 256px, so uploads stay small. */
async function toSquareJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE; canvas.height = SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();
  return await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read that image."))), "image/jpeg", 0.88));
}

export default function AvatarPicker({ name, current }: { name: string; current: string | null }) {
  const router = useRouter();
  const parsed = parseAvatar(current);
  const [icon, setIcon] = useState<string>(parsed.kind === "preset" ? parsed.icon : PRESET_ICONS[0].id);
  const [colour, setColour] = useState<string>(parsed.kind === "preset" ? parsed.colour : PRESET_COLOURS[1]);
  const [upload, setUpload] = useState<{ blob: Blob; url: string } | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);
  const [pending, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const shown = upload?.url ?? current;

  function done(r: { error?: string } | { ok: true }, text: string) {
    if ("error" in r && r.error) { setMessage({ text: r.error, error: true }); return; }
    setMessage({ text });
    setUpload(null);
    router.refresh();
  }

  async function pick(f: File | undefined) {
    setMessage(null);
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setMessage({ text: "Use a JPEG, PNG or WebP image.", error: true }); return; }
    if (f.size > 15 * 1024 * 1024) { setMessage({ text: "That file is over 15 MB.", error: true }); return; }
    try {
      const blob = await toSquareJpeg(f);
      setUpload({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      setMessage({ text: (e as Error).message || "Could not read that image.", error: true });
    }
  }

  const choice = (on: boolean): React.CSSProperties => ({
    width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    border: on ? "2px solid var(--ink)" : "1px solid var(--rule)", background: "var(--bg)", padding: 0,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <Avatar name={name} url={shown} size={72} />
        <div style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", flex: "1 1 220px" }}>
          {upload ? "Preview of your upload. Save it to use it everywhere." :
            parsed.kind === "image" ? "Your own picture." :
            parsed.kind === "preset" ? "A built-in picture." : "No picture yet: people see the first letter of your name."}
        </div>
      </div>

      <div>
        <div style={{ font: mono(10, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 8 }}>YOUR OWN PICTURE</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden
                 onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          <button type="button" style={btn} onClick={() => input.current?.click()} disabled={pending}>Choose an image…</button>
          {upload && (
            <>
              <button type="button" style={btnPrimary} disabled={pending} onClick={() => start(async () => {
                const fd = new FormData();
                fd.append("file", new File([upload.blob], "avatar.jpg", { type: "image/jpeg" }));
                done(await uploadAvatar(fd), "Picture saved.");
              })}>{pending ? "Saving…" : "Save picture"}</button>
              <button type="button" style={btn} disabled={pending} onClick={() => setUpload(null)}>Cancel</button>
            </>
          )}
        </div>
        <p style={{ font: "400 11.5px/1.5 var(--sans)", color: "var(--mute)", margin: "6px 0 0" }}>
          JPEG, PNG or WebP. It is cropped to a square and scaled to 256 px before upload.
        </p>
      </div>

      <div>
        <div style={{ font: mono(10, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 8 }}>OR A BUILT-IN PICTURE</div>
        <div role="radiogroup" aria-label="Icon" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {PRESET_ICONS.map((i) => (
            <button key={i.id} type="button" role="radio" aria-checked={icon === i.id} aria-label={i.label} title={i.label}
                    onClick={() => setIcon(i.id)} style={choice(icon === i.id)}>
              <Avatar name="" url={presetValue(i.id, colour)} size={30} />
            </button>
          ))}
        </div>
        <div role="radiogroup" aria-label="Colour" style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          {PRESET_COLOURS.map((c) => (
            <button key={c} type="button" role="radio" aria-checked={colour === c} aria-label={`Colour ${c}`}
                    onClick={() => setColour(c)}
                    style={{ ...choice(colour === c), width: 28, height: 28 }}>
              <span style={{ width: 18, height: 18, background: c, display: "block" }} />
            </button>
          ))}
          <button type="button" style={{ ...btnPrimary, marginLeft: 6 }} disabled={pending}
                  onClick={() => start(async () => done(await setAvatarPreset(icon, colour), "Picture saved."))}>
            Use this picture
          </button>
        </div>
      </div>

      {parsed.kind !== "initial" && (
        <div>
          <button type="button" style={{ ...btn, borderColor: "var(--rule)", color: "var(--mute)" }} disabled={pending}
                  onClick={() => start(async () => done(await clearAvatar(), "Picture removed."))}>
            Remove picture
          </button>
        </div>
      )}

      {message && (
        <p role={message.error ? "alert" : "status"} style={{ font: "400 12px/1.5 var(--sans)", margin: 0, color: message.error ? "var(--err)" : "var(--ok)" }}>
          {message.text}
        </p>
      )}
    </div>
  );
}
