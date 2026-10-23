import { test } from "node:test";
import assert from "node:assert/strict";
import { likeTerm, isRowId } from "../lib/query.ts";
import { parseAvatar } from "../lib/avatar.ts";

test("search terms cannot carry PostgREST filter syntax", () => {
  assert.equal(likeTerm("western, blot"), "western blot");
  assert.equal(likeTerm("x),id.eq.1"), "x id.eq.1");
  assert.equal(likeTerm('50% "methanol"'), "50 methanol");
  assert.equal(likeTerm("   "), "");
});

test("row ids", () => {
  assert.ok(isRowId("u-bhatt"));
  assert.ok(isRowId("6f1c2a52-0b5e-4f3e-9d0a-2d1f3c4b5a69"));
  assert.ok(!isRowId("x),sender_id.eq.y"));
  assert.ok(!isRowId(""));
});

test("avatar values", () => {
  assert.deepEqual(parseAvatar("preset:dna:#0B7A4B"), { kind: "preset", icon: "dna", colour: "#0B7A4B" });
  assert.equal(parseAvatar("preset:dna:#123456").kind, "initial");          // colour not in the palette
  assert.equal(parseAvatar("javascript:alert(1)").kind, "initial");
  assert.equal(parseAvatar("data:image/svg+xml;base64,AAAA").kind, "initial"); // SVG is refused
  assert.equal(parseAvatar("https://x.supabase.co/a.jpg").kind, "image");
  assert.equal(parseAvatar(null).kind, "initial");
});
