import type { PubRow } from "@/lib/openalex/store";

/**
 * Citation profile from the stored publications. Nothing here asks OpenAlex:
 * it reworks what the last full sync stored per work.
 *
 * OpenAlex gives each work its citations per calendar year for roughly the
 * last ten years. A work's total at the end of year Y is its total today minus
 * what it received after Y, which is exact for every year in that window.
 * Before the window the per-year counts are missing, so nothing is shown there.
 */

export const WINDOW_YEARS = 10;

export function hIndexOf(counts: number[]): number {
  const sorted = [...counts].sort((a, b) => b - a);
  let h = 0;
  while (h < sorted.length && sorted[h] >= h + 1) h++;
  return h;
}

const received = (p: PubRow) => p.counts_by_year ?? [];

/** Total citations of a work at the end of year y. */
function totalAt(p: PubRow, y: number): number {
  return p.cited_by_count - received(p).filter((r) => r.year > y).reduce((n, r) => n + r.cited_by_count, 0);
}

export type YearPoint = { year: number; value: number };

export type CitationProfile = {
  /** False until a full sync has stored per-work history. */
  hasHistory: boolean;
  year: number;
  hIndexByYear: YearPoint[];          // end of each year; the current year is "so far"
  citationsByYear: YearPoint[];       // received in each year, summed over works
  thisYear: number;
  lastYear: number;
  topThisYear: { openalex_id: string; title: string; n: number }[];
  /** Per work: received per year over the last six years, oldest first. */
  trend: Map<string, number[]>;
  trendYears: number[];
};

export function citationProfile(pubs: PubRow[], now = new Date()): CitationProfile {
  const year = now.getFullYear();
  const years = Array.from({ length: WINDOW_YEARS }, (_, i) => year - WINDOW_YEARS + 1 + i);
  const hasHistory = pubs.some((p) => received(p).length > 0);

  const hIndexByYear = hasHistory
    ? years.map((y) => ({
        year: y,
        value: hIndexOf(pubs.filter((p) => (p.year ?? 0) <= y).map((p) => Math.max(0, totalAt(p, y)))),
      }))
    : [];

  const citationsByYear = years.map((y) => ({
    year: y,
    value: pubs.reduce((n, p) => n + (received(p).find((r) => r.year === y)?.cited_by_count ?? 0), 0),
  }));

  const inYear = (p: PubRow, y: number) => received(p).find((r) => r.year === y)?.cited_by_count ?? 0;
  const topThisYear = pubs
    .map((p) => ({ openalex_id: p.openalex_id, title: p.title, n: inYear(p, year) }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);

  const trendYears = years.slice(-6);
  const trend = new Map(pubs.map((p) => [p.openalex_id, trendYears.map((y) => inYear(p, y))]));

  return {
    hasHistory, year, hIndexByYear, citationsByYear,
    thisYear: citationsByYear.at(-1)?.value ?? 0,
    lastYear: citationsByYear.at(-2)?.value ?? 0,
    topThisYear, trend, trendYears,
  };
}
