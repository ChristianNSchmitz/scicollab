import { test } from "node:test";
import assert from "node:assert/strict";
import { planLinks, linkIndex, entryLabel, canEditLinks } from "../lib/data-links.ts";

const set = (...x: string[]) => new Set(x);

test("saving adds what was ticked and removes what was unticked", () => {
  const plan = planLinks(set("a", "b"), set("b", "c"), set("a", "b", "c", "d"));
  assert.deepEqual(plan.add, ["c"]);
  assert.deepEqual(plan.remove, ["a"]);
});

test("nothing changes when the ticked set is the linked set", () => {
  assert.deepEqual(planLinks(set("a", "b"), set("a", "b"), set("a", "b", "c")), { add: [], remove: [] });
});

test("an id the form never offered can be neither linked nor unlinked", () => {
  // "z" is from another project (or was made up); "old" is linked but was not on the form.
  const plan = planLinks(set("old"), set("z"), set("a", "b"));
  assert.deepEqual(plan, { add: [], remove: [] });
});

test("unticking everything removes every offered link", () => {
  assert.deepEqual(planLinks(set("a", "b"), set(), set("a", "b", "c")), { add: [], remove: ["a", "b"] });
});

test("the lookups read both ways: data to code and notebook, code and notebook to data", () => {
  const idx = linkIndex([
    { dataset_id: "d1", code_file_id: "c1", entry_id: null },
    { dataset_id: "d1", code_file_id: "c2", entry_id: null },
    { dataset_id: "d1", code_file_id: null, entry_id: "e1" },
    { dataset_id: "d2", code_file_id: "c1", entry_id: null },
  ]);
  assert.deepEqual(idx.codeOf("d1").sort(), ["c1", "c2"]);
  assert.deepEqual(idx.entriesOf("d1"), ["e1"]);
  assert.deepEqual(idx.datasetsOfCode("c1").sort(), ["d1", "d2"]);
  assert.deepEqual(idx.datasetsOfEntry("e1"), ["d1"]);
  assert.deepEqual(idx.codeOf("nope"), []);
  assert.deepEqual(idx.datasetsOfCode("nope"), []);
});

test("a notebook entry is named by its first line and its date", () => {
  assert.equal(entryLabel("p19 run, triplicate. 4.2%, 3.8%\nsecond line", "2026-09-12T10:00:00Z"), "2026-09-12 · p19 run, triplicate. 4.2%, 3.8%");
  assert.equal(entryLabel("   \n  ", "2026-09-12T10:00:00Z"), "2026-09-12 · (empty entry)");
  const long = entryLabel("x".repeat(200), "2026-09-12T10:00:00Z");
  assert.ok(long.length <= "2026-09-12 · ".length + 70, long);
  assert.ok(long.endsWith("…"), long);
});

test("who may change a dataset's links: its owner or the project's owner, and only on the project", () => {
  const base = { userId: "alex", projectOwnerId: "alex", datasetOwnerId: "alex", onProject: true };
  assert.equal(canEditLinks(base), true);                                                       // owner of both
  assert.equal(canEditLinks({ ...base, userId: "maja", projectOwnerId: "alex", datasetOwnerId: "maja" }), true);   // contributor, own dataset
  assert.equal(canEditLinks({ ...base, userId: "alex", datasetOwnerId: "maja" }), true);        // project owner, someone else's dataset
  assert.equal(canEditLinks({ ...base, userId: "maja", datasetOwnerId: "alex" }), false);       // contributor, not their dataset
  assert.equal(canEditLinks({ ...base, userId: "sanjana", datasetOwnerId: "alex", onProject: false }), false);     // outsider
  assert.equal(canEditLinks({ ...base, userId: "sanjana", datasetOwnerId: "sanjana", onProject: false }), false);  // owns the dataset but is not on the project
});
