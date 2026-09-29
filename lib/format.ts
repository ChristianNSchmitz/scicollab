/** Two-letter initials from a display name, falling back to an email local part. */
export function initialsOf(name: string): string {
  const clean = (name || "").trim();
  if (!clean) return "··";
  const base = clean.includes("@") ? clean.split("@")[0].replace(/[._-]+/g, " ") : clean;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return base.slice(0, 2).toUpperCase();
}

/** "4 h ago" / "3 d ago" — the terse form the boards use. */
export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)} min ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)} h ago`;
  const d = h / 24;
  if (d < 31) return `${Math.floor(d)} d ago`;
  return new Date(iso).toISOString().slice(0, 10);
}
