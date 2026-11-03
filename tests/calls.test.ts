import { test } from "node:test";
import assert from "node:assert/strict";
import { callFilters, callsHref, safeBack } from "../lib/calls.ts";

test("call filters: only known statuses and real dates are kept", () => {
  assert.deepEqual(callFilters({}), { status: "open", term: "", due: "", mine: false });
  assert.equal(callFilters({ status: "filled" }).status, "filled");
  assert.equal(callFilters({ status: "all" }).status, "all");
  assert.equal(callFilters({ status: "bogus" }).status, "open");
  assert.equal(callFilters({ due: "2026-12-01" }).due, "2026-12-01");
  assert.equal(callFilters({ due: "tomorrow" }).due, "");
  assert.equal(callFilters({ mine: "1" }).mine, true);
  assert.equal(callFilters({ mine: "yes" }).mine, false);
});

test("call filters: a search term cannot carry filter syntax", () => {
  assert.equal(callFilters({ q: "seahorse,title.eq.x)" }).term.includes(","), false);
  assert.equal(callFilters({ q: "seahorse,title.eq.x)" }).term.includes(")"), false);
});

test("the Calls tab link keeps only what is set", () => {
  assert.equal(callsHref({}), "/home?feed=calls");
  assert.equal(callsHref({ status: "open" }), "/home?feed=calls");
  assert.equal(callsHref({ status: "filled", q: "iPSC", mine: "1" }), "/home?feed=calls&q=iPSC&status=filled&mine=1");
  assert.equal(callsHref({ due: "2026-12-01" }), "/home?feed=calls&due=2026-12-01");
});

test("every address the Calls tab builds is one a form may return to", () => {
  for (const f of [{}, { status: "filled" }, { q: "iPSC neurons", due: "2026-12-01", mine: "1", status: "all" }, { q: "100% & more=x" }]) {
    const href = callsHref(f);
    assert.equal(safeBack(href), href, href);
  }
});

test("the address a form asks to go back to must stay in the feed", () => {
  for (const ok of ["/home", "/home?feed=calls", "/home?feed=calls&q=iPSC&status=filled", "/home?intent=collab&room=crispr"]) assert.equal(safeBack(ok), ok, ok);
  for (const bad of ["", "https://evil.example", "//evil.example", "/home//evil.example", "/home@evil.example", "/homepage", "/calls", "/home?x=<script>", "/home?feed=calls\nSet-Cookie: x", "javascript:alert(1)", "/home#frag"]) {
    assert.equal(safeBack(bad), null, JSON.stringify(bad));
  }
});
