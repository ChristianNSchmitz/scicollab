import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSeen, serializeSeen, isSeen, markSeen, SEEN_MAX } from "../lib/seen.ts";

const id = "3f2c9a1e-8b7d-4c55-9e10-0a1b2c3d4e5f";
const noon = "2026-11-05T12:00:00.000Z";
const later = "2026-11-05T13:00:00.000Z";

test("a post is seen once its latest activity was seen, and comes back when there is newer activity", () => {
  const seen = markSeen(new Map(), id, noon);
  assert.equal(isSeen(seen, id, noon), true);
  assert.equal(isSeen(seen, id, "2026-11-05T11:00:00.000Z"), true);  // older activity: already seen
  assert.equal(isSeen(seen, id, later), false);                      // a new reply: shown again
  assert.equal(isSeen(seen, "other-post", noon), false);             // never seen
});

test("marking never moves an entry back, and ignores a time that is not one", () => {
  const seen = markSeen(markSeen(new Map(), id, later), id, noon);
  assert.equal(seen.get(id), Date.parse(later));
  assert.equal(markSeen(new Map(), id, "not a time").size, 0);
});

test("the cookie round-trips and drops what is old or malformed", () => {
  const now = Date.parse(later);
  const seen = markSeen(markSeen(new Map(), id, noon), "old-post", "2026-10-01T00:00:00.000Z");
  const raw = serializeSeen(seen, now);
  assert.ok(!raw.includes("old-post"));
  assert.equal(parseSeen(raw).get(id), Date.parse(noon));
  assert.equal(parseSeen("junk,;;,a b.zz,..,x.0").size, 0);
  assert.equal(parseSeen(undefined).size, 0);
});

test("the cookie keeps only the newest entries and stays small", () => {
  const now = Date.parse(later);
  let seen = new Map<string, number>();
  for (let i = 0; i < SEEN_MAX + 15; i++) seen.set(`${id.slice(0, -2)}${String(i).padStart(2, "0")}`, now - i * 1000);
  const raw = serializeSeen(seen, now);
  assert.equal(parseSeen(raw).size, SEEN_MAX);
  assert.ok(raw.length < 2500, `cookie is ${raw.length} bytes`);
  assert.ok(parseSeen(raw).has(`${id.slice(0, -2)}00`));           // the newest stays
  assert.ok(!parseSeen(raw).has(`${id.slice(0, -2)}${SEEN_MAX + 10}`)); // the oldest goes
});
