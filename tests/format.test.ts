import { test } from "node:test";
import assert from "node:assert/strict";
import { firstNameOf, initialsOf } from "../lib/format.ts";

test("the first name is what people are called, not their title or tag", () => {
  assert.equal(firstNameOf("Alex Rivera"), "Alex");
  assert.equal(firstNameOf("Alex Rivera (example)"), "Alex");
  assert.equal(firstNameOf("Alex Rivera.ex"), "Alex");
  assert.equal(firstNameOf("Dr Camille Laurent (example)"), "Camille");
  assert.equal(firstNameOf("Prof. Dr. Jan Müller"), "Jan");
  assert.equal(firstNameOf("María-José García"), "María-José");
});

test("an initial is not a first name when a real word follows it", () => {
  assert.equal(firstNameOf("S. Bhatt (example)"), "Bhatt");
  assert.equal(firstNameOf("T. Okafor"), "Okafor");
  assert.equal(firstNameOf("J Newcomer"), "Newcomer");
  assert.equal(firstNameOf("Q."), "Q.");
});

test("a member with no display name falls back to their email, and nothing breaks on empty input", () => {
  assert.equal(firstNameOf("jane.doe@uni.example"), "jane");
  assert.equal(firstNameOf(""), "");
  assert.equal(firstNameOf("   "), "");
  assert.equal(firstNameOf(undefined as unknown as string), "");
});

test("a very long name is cut so it cannot push the top bar around", () => {
  const n = firstNameOf("Wolfeschlegelsteinhausenbergerdorff Smith");
  assert.ok(n.length <= 16, n);
  assert.ok(n.endsWith("…"), n);
});

test("the first name and the avatar letter agree on who the person is", () => {
  for (const name of ["Alex Rivera (example)", "Dr Camille Laurent", "Alex Rivera.ex"]) {
    assert.equal(initialsOf(name), firstNameOf(name)[0].toUpperCase(), name);
  }
});

test("snippetOf keeps a short reply whole and cuts a long one at a word", async () => {
  const { snippetOf } = await import("../lib/format.ts");
  assert.equal(snippetOf("  Try  a lower\nvoltage "), "Try a lower voltage");
  const long = "Lower the voltage and add the Mg2+ before the wash step, then repeat the run on a fresh plate to confirm it".repeat(2);
  const out = snippetOf(long, 40);
  assert.ok(out.length <= 40 && out.endsWith("…"), out);
  assert.ok(!/\s…$/.test(out));
});
