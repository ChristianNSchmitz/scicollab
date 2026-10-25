import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { demoFilePath, parseCsv } from "../lib/demo/files.ts";

const ROOT = path.join(process.cwd(), "demo-files");

test("demo files can only be read from inside demo-files/", () => {
  assert.equal(demoFilePath("pj-mateo/README.md"), path.join(ROOT, "pj-mateo/README.md"));
  for (const bad of ["../package.json", "pj-mateo/../../.env.local", "/etc/passwd", "", null, undefined, "a\0b", ".", "pj-mateo/.."]) {
    assert.equal(demoFilePath(bad as string), null, String(bad));
  }
});

test("CSV reader keeps quoted commas, quotes and newlines", () => {
  assert.deepEqual(parseCsv('a,b,c\n1,"x, y",3\n'), [["a", "b", "c"], ["1", "x, y", "3"]]);
  assert.deepEqual(parseCsv('k,v\r\n"say ""hi""","two\nlines"'), [["k", "v"], ['say "hi"', "two\nlines"]]);
  assert.deepEqual(parseCsv("x\n\n"), [["x"], [""]]);
});
