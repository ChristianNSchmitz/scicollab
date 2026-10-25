import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Mounts an artboard lifted from the September design boards.
 *
 * The fragments are fixed-width (1440 for a full screen, narrower for panels)
 * and were authored against the board's CSS variables, which globals.css now
 * defines application-wide, so they render unchanged.
 *
 * Wiring: the boards draw their controls as <button> and <span>, never as
 * links — they were never meant to navigate. Rather than overlay hit-boxes at
 * guessed coordinates, `links` maps a control's exact visible text to a route
 * and the element is rewritten into an <a> in place, keeping its own styling.
 * That works the same way on every screen.
 */

const ESCAPE: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESCAPE[c]);

/** Decode the few entities the boards use, so `links` keys can be written plainly. */
function decode(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function wire(html: string, links: Record<string, string>): string {
  if (!Object.keys(links).length) return html;

  // Normalise keys once: trimmed, whitespace-collapsed, case-insensitive.
  const table = new Map<string, string>();
  for (const [label, href] of Object.entries(links)) {
    table.set(label.replace(/\s+/g, " ").trim().toLowerCase(), href);
  }

  return html.replace(
    /<(button|span)\b([^>]*)>([^<]+)<\/\1>/g,
    (whole, _tag, attrs: string, text: string) => {
      const key = decode(text).replace(/\s+/g, " ").trim().toLowerCase();
      const href = table.get(key);
      if (!href) return whole;

      const style = attrs.match(/style="([^"]*)"/)?.[1] ?? "";
      // Only force a colour when the control did not choose one, so the
      // design's own colours always win over the global link colour.
      const extra = /(^|;)\s*color\s*:/.test(style)
        ? "text-decoration:none"
        : "color:inherit;text-decoration:none";
      const merged = style ? `${style.replace(/;\s*$/, "")};${extra}` : extra;

      return `<a href="${esc(href)}" style="${esc(merged)}">${text}</a>`;
    }
  );
}

/**
 * The boards end each screen with a review strip — "COVERAGE R09 · P01 …
 * both personas" — that maps the screen to the requirement audit. It is a
 * note for the design review, not part of the product, so public pages drop
 * it. Matched by its label, so it works the same on every board.
 */
const COVERAGE_STRIP = /<div[^>]*>\s*<span[^>]*>COVERAGE<\/span>[\s\S]*?<\/div>/g;

export default function Screen({
  id,
  links = {},
  className,
  hideCoverage = false,
  transform,
}: {
  id: string;
  links?: Record<string, string>;
  className?: string;
  /** Remove the board's COVERAGE review strip (public pages). */
  hideCoverage?: boolean;
  /** Last edit to the artboard's HTML before it is mounted, e.g. to swap an
   *  example block for a slot that live content fills. Must return safe HTML. */
  transform?: (html: string) => string;
}) {
  let html: string;
  try {
    html = readFileSync(join(process.cwd(), "design", "screens", `${id}.html`), "utf8");
  } catch {
    return (
      <div style={{ padding: 24, font: "400 12px/1.6 var(--mono)", color: "var(--err)" }}>
        Screen <code>{id}</code> is not in design/screens. Run{" "}
        <code>node scripts/extract-screens.mjs</code>.
      </div>
    );
  }

  if (hideCoverage) html = html.replace(COVERAGE_STRIP, "");
  if (transform) html = transform(html);

  return <div className={["sc-screen", className].filter(Boolean).join(" ")} dangerouslySetInnerHTML={{ __html: wire(html, links) }} />;
}
