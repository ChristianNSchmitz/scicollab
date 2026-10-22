import { test } from "node:test";
import assert from "node:assert/strict";
import { hIndexOf, citationProfile } from "../lib/record/citations.ts";

const pub = (id: string, year: number, byYear: Record<number, number>) => ({
  user_id: "u", openalex_id: id, doi: null, title: id, year, pub_date: `${year}-01-01`, venue: "", type: "article",
  cited_by_count: Object.values(byYear).reduce((a, b) => a + b, 0), prev_cited_by_count: 0,
  first_seen_at: "", updated_at: "",
  counts_by_year: Object.entries(byYear).map(([y, n]) => ({ year: Number(y), cited_by_count: n })),
});

test("h-index", () => {
  assert.equal(hIndexOf([]), 0);
  assert.equal(hIndexOf([0, 0]), 0);
  assert.equal(hIndexOf([10, 8, 5, 4, 3]), 4);
  assert.equal(hIndexOf([25, 8, 5, 3, 3]), 3);
  assert.equal(hIndexOf([1, 1, 1]), 1);
});

test("h-index history uses each paper's total at the end of the year", () => {
  const now = new Date("2026-06-01");
  const pubs = [
    pub("a", 2020, { 2021: 2, 2022: 3, 2026: 5 }),  // 2 at end of 2021, 5 at end of 2022, 10 now
    pub("b", 2021, { 2022: 1, 2025: 2 }),           // 1 at end of 2022, 3 at end of 2025
    pub("c", 2025, { 2026: 4 }),                    // not yet published before 2025
  ];
  const c = citationProfile(pubs as any, now);
  const h = Object.fromEntries(c.hIndexByYear.map((p) => [p.year, p.value]));
  assert.equal(h[2020], 0);
  assert.equal(h[2021], 1);   // a=2
  assert.equal(h[2022], 1);   // a=5, b=1
  assert.equal(h[2025], 2);   // a=5, b=3, c=0
  assert.equal(h[2026], 3);   // a=10, b=3, c=4
  assert.equal(c.thisYear, 9);
  assert.equal(c.lastYear, 2);
  assert.deepEqual(c.topThisYear.map((t) => t.openalex_id), ["a", "c"]);
});

test("no history before a full sync has stored per-year counts", () => {
  const c = citationProfile([{ ...pub("a", 2020, {}), cited_by_count: 12, counts_by_year: [] }] as any);
  assert.equal(c.hasHistory, false);
  assert.deepEqual(c.hIndexByYear, []);
});
