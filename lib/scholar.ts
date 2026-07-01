// ─── OpenAlex scholarly-metadata client ──────────────────────────────────────
// Loads real publication metadata and author metrics (h-index, citations)
// from api.openalex.org — free, no API key, CORS-enabled.

import { saveMockProfile, importPublication, getUserPublications, getCurrentUserId, type Publication } from "./mock-db";

const API = "https://api.openalex.org";

export type ScholarAuthor = {
  id: string;              // OpenAlex id, e.g. "A5077142042"
  display_name: string;
  institution: string | null;
  works_count: number;
  cited_by_count: number;
  h_index: number;
  orcid: string | null;
};

export type ScholarWork = {
  title: string;
  year: number;
  journal: string | null;
  doi: string | null;
  cited_by_count: number;
  authors: string[];
  abstract: string | null;
  type: Publication["type"];
  tags: string[];
};

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapAuthor(a: any): ScholarAuthor {
  const inst = (a.last_known_institutions ?? [])[0];
  return {
    id: String(a.id).split("/").pop() ?? "",
    display_name: a.display_name,
    institution: inst?.display_name ?? null,
    works_count: a.works_count ?? 0,
    cited_by_count: a.cited_by_count ?? 0,
    h_index: a.summary_stats?.h_index ?? 0,
    orcid: a.orcid ? String(a.orcid).replace("https://orcid.org/", "") : null,
  };
}

/** Reconstruct plain-text abstract from OpenAlex's inverted index. */
function abstractFrom(inv: Record<string, number[]> | null): string | null {
  if (!inv) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const pos of positions) words[pos] = word;
  }
  const text = words.join(" ").trim();
  return text.length > 20 ? text.slice(0, 600) : null;
}

function mapWork(w: any): ScholarWork {
  const journal = w.primary_location?.source?.display_name ?? null;
  const isPreprint = w.primary_location?.source?.type === "repository" || w.type === "preprint";
  return {
    title: w.display_name ?? "Untitled",
    year: w.publication_year ?? new Date().getFullYear(),
    journal,
    doi: w.doi ? String(w.doi).replace("https://doi.org/", "") : null,
    cited_by_count: w.cited_by_count ?? 0,
    authors: (w.authorships ?? []).slice(0, 10).map((x: any) => x.author?.display_name).filter(Boolean),
    abstract: abstractFrom(w.abstract_inverted_index ?? null),
    type: isPreprint ? "preprint" : "paper",
    tags: (w.concepts ?? []).slice(0, 4).map((c: any) => c.display_name).filter(Boolean),
  };
}

/** Search authors by name. */
export async function searchScholarAuthors(query: string): Promise<ScholarAuthor[]> {
  const res = await fetch(`${API}/authors?search=${encodeURIComponent(query)}&per-page=8`);
  if (!res.ok) throw new Error(`OpenAlex: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map(mapAuthor);
}

/** Fetch an author's most-cited works. */
export async function fetchScholarWorks(authorId: string, limit = 15): Promise<ScholarWork[]> {
  const res = await fetch(`${API}/works?filter=author.id:${authorId}&sort=cited_by_count:desc&per-page=${limit}`);
  if (!res.ok) throw new Error(`OpenAlex: ${res.status}`);
  const data = await res.json();
  return (data.results ?? []).map(mapWork);
}

/**
 * Import an author's metrics + publications into the current user's profile.
 * Skips works that are already imported (matched by DOI or title).
 * Returns the number of newly imported publications.
 */
export async function importScholarData(author: ScholarAuthor): Promise<number> {
  const works = await fetchScholarWorks(author.id);

  saveMockProfile({
    full_name:         author.display_name,
    institution:       author.institution ?? undefined as unknown as string,
    h_index:           author.h_index,
    citation_count:    author.cited_by_count,
    publication_count: author.works_count,
    orcid_id:          author.orcid,
    is_verified:       true,
  });

  const existing = getUserPublications(getCurrentUserId());
  const seen = new Set(existing.flatMap((p) => [p.doi ?? "", p.title.toLowerCase()]));

  let imported = 0;
  for (const w of works) {
    if ((w.doi && seen.has(w.doi)) || seen.has(w.title.toLowerCase())) continue;
    importPublication({
      user_id: getCurrentUserId(),
      title: w.title,
      abstract: w.abstract,
      authors: w.authors,
      journal: w.journal,
      year: w.year,
      doi: w.doi,
      arxiv_id: null,
      type: w.type,
      tags: w.tags,
      citation_count: w.cited_by_count,
      read_count: Math.max(50, w.cited_by_count * 12),
      like_count: 0,
      liked_by: [],
      status: w.type === "preprint" ? "preprint" : "published",
    });
    imported++;
  }
  return imported;
}
