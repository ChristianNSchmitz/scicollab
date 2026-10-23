import { test } from "node:test";
import assert from "node:assert/strict";
import { normaliseOrcid, orcidProblem, checksumOk } from "../lib/orcid.ts";

test("accepts the canonical form, URLs and bare digits", () => {
  for (const v of ["0000-0002-1825-0097", "https://orcid.org/0000-0002-1825-0097", "orcid.org/0000-0002-1825-0097", "0000000218250097", " 0000-0002-1825-0097 "]) {
    assert.equal(normaliseOrcid(v), "0000-0002-1825-0097", v);
  }
});

test("handles X as the check character", () => {
  assert.equal(normaliseOrcid("0000-0002-1694-233x"), "0000-0002-1694-233X");
  assert.ok(checksumOk("0000-0002-1694-233X"));
});

test("rejects a wrong check digit and says why", () => {
  assert.equal(normaliseOrcid("0000-0002-1825-0098"), null);
  assert.match(orcidProblem("0000-0002-1825-0098")!, /typo/);
  assert.match(orcidProblem("123")!, /16 characters/);
  assert.equal(orcidProblem(""), null);
});
