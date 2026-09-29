/**
 * Lift artboards out of the September design boards.
 *
 * Each board repeats a fixed shape: a label row (number, name, dimensions)
 * followed by the artboard itself — a fixed-width <div> that carries the whole
 * screen. We match the label, take the <div> that follows it, and walk the tag
 * stream to find its close so the fragment comes out balanced.
 *
 * Output: design/screens/<slug>.html plus design/screens/manifest.json
 *
 *   node scripts/extract-screens.mjs ../scicollab/design/boards
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join, basename } from "node:path";

const SRC = process.argv[2] ?? "../scicollab/design/boards";
const OUT = "design/screens";

const LABEL =
  /<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:10px">\s*<span[^>]*>([^<]{1,6})<\/span>\s*<span[^>]*>([^<]+)<\/span>\s*(?:<span[^>]*>([^<]*)<\/span>)?/g;

/** End index of the <div> element beginning at `start`. */
function closeOf(html, start) {
  const tag = /<(\/?)div\b[^>]*?(\/?)>/gi;
  tag.lastIndex = start;
  let depth = 0;
  for (let m; (m = tag.exec(html)); ) {
    if (m[2] === "/") continue; // self-closing
    depth += m[1] ? -1 : 1;
    if (depth === 0) return tag.lastIndex;
  }
  return -1;
}

const slug = (s) =>
  s
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);

mkdirSync(OUT, { recursive: true });

const manifest = [];
for (const file of readdirSync(SRC).sort()) {
  if (!file.endsWith(".html")) continue;
  const html = readFileSync(join(SRC, file), "utf8");

  // Tokens live on the board wrapper; every artboard inside relies on them.
  const tokens = html.match(/<div style="(--bg:[^"]+)"/)?.[1] ?? "";

  const board = basename(file).replace(/^SciCollab\s*/, "").replace(/\.dc\.html$|\.html$/, "");
  const code = board.match(/^([B-K]\d)/)?.[1] ?? "FN";

  LABEL.lastIndex = 0;
  for (let m; (m = LABEL.exec(html)); ) {
    const [, num, name, dim = ""] = m;
    const open = html.indexOf("<div", m.index + m[0].length);
    if (open < 0) continue;
    const end = closeOf(html, open);
    if (end < 0) continue;

    const width = Number(dim.match(/^(\d{2,5})\s*×/)?.[1] ?? 1440);
    const id = `${code.toLowerCase()}-${slug(name)}`;
    writeFileSync(join(OUT, `${id}.html`), html.slice(open, end), "utf8");
    manifest.push({
      id,
      num: num.trim(),
      name: name.trim(),
      dim: dim.trim(),
      width,
      board,
      code,
      tokens,
    });
  }
}

writeFileSync(join(OUT, "manifest.json"), JSON.stringify(manifest, null, 1), "utf8");
console.log(`extracted ${manifest.length} screens from ${SRC} → ${OUT}`);
