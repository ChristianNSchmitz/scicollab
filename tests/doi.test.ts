import { test } from "node:test";
import assert from "node:assert/strict";
import { doiOf } from "../lib/posts/doi.ts";

test("a DOI is found in text and in doi.org links", () => {
  assert.equal(doiOf("See https://doi.org/10.1038/s41586-020-2649-2."), "10.1038/s41586-020-2649-2");
  assert.equal(doiOf("doi:10.1101/2024.01.15.575123, preprint"), "10.1101/2024.01.15.575123");
  assert.equal(doiOf("(10.1016/j.cell.2023.01.001)"), "10.1016/j.cell.2023.01.001");
});

test("text without a DOI has none", () => {
  assert.equal(doiOf("Version 10.2 of the protocol"), null);
  assert.equal(doiOf(""), null);
  assert.equal(doiOf(null), null);
});
