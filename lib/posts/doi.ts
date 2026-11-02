import type { LinkPreview } from "@/lib/posts/link-preview";

/**
 * A DOI in a post becomes a paper card: title, journal and year from
 * OpenAlex, read once when the post is saved. Without an answer (offline,
 * not indexed yet) the card still shows the DOI and links to it.
 */

const DOI_RE = /\b(10\.\d{4,9}\/[^\s<>"'()]+[^\s<>"'().,;:!?])/i;

/** The first DOI in a text, also inside a doi.org link. */
export function doiOf(text: string | null | undefined): string | null {
  return String(text ?? "").match(DOI_RE)?.[1] ?? null;
}

export async function paperPreview(doi: string): Promise<LinkPreview> {
  const url = `https://doi.org/${doi}`;
  const base = process.env.OPENALEX_BASE_URL || "https://api.openalex.org";
  try {
    const res = await fetch(`${base}/works/doi:${encodeURI(doi)}?select=display_name,publication_year,primary_location,authorships`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const w = await res.json();
      const authors = (w.authorships ?? []).map((a: any) => a.author?.display_name).filter(Boolean);
      const byline = authors.length > 2 ? `${authors[0]} et al.` : authors.join(" and ");
      const journal = w.primary_location?.source?.display_name ?? "";
      return {
        url, kind: "paper", site: "Paper",
        title: String(w.display_name ?? doi).slice(0, 300),
        description: [byline, journal, w.publication_year].filter(Boolean).join(" · "),
      };
    }
  } catch { /* the plain card below */ }
  return { url, kind: "paper", site: "Paper", title: `doi:${doi}`, description: "" };
}
