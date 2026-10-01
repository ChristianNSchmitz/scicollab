/**
 * The avatar letter: the first letter of the first name. Parenthetical notes
 * such as "(example)" and academic titles are skipped, so "Dr Camille
 * Laurent (example)" gives "C". Falls back to an email's local part.
 */
const TITLES = /^(dr|prof|professor|mr|mrs|ms|mx|sir|dame|pd|priv\.?-?doz)\.?$/i;
export function initialsOf(name: string): string {
  const clean = (name || "").replace(/\([^)]*\)/g, " ").trim();
  const base = clean.includes("@") ? clean.split("@")[0].replace(/[._-]+/g, " ") : clean;
  const first = base.split(/\s+/).find((w) => w && !TITLES.test(w));
  const letter = first?.match(/\p{L}/u)?.[0];
  return letter ? letter.toUpperCase() : "·";
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
