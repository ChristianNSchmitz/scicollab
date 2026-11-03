import { test } from "node:test";
import assert from "node:assert/strict";
import { isPageNavigation, navigationFinished, LOADER_DELAY_MS } from "../lib/nav-loader.ts";

const here = "https://scicollab.net/home?feed=calls";
const go = (href: string, extra: Partial<Parameters<typeof isPageNavigation>[0]> = {}) =>
  isPageNavigation({ href, base: here, ...extra });

test("the loading screen waits a full second before it appears", () => {
  assert.equal(LOADER_DELAY_MS, 1000);
});

test("a link to another page of the site is a page change", () => {
  assert.equal(go("/groups"), true);
  assert.equal(go("https://scicollab.net/projects/p-1?tab=data"), true);
  assert.equal(go("/posts/abc#replies"), true);
});

test("a change of tab or filter on the same page counts, since the old page just sits there until the new one arrives", () => {
  assert.equal(go("/home?feed=following"), true);
  assert.equal(go("/home"), true);
});

test("going nowhere is not a page change", () => {
  assert.equal(go("/home?feed=calls"), false);            // the page you are on
  assert.equal(go("/home?feed=calls#feed"), false);       // same page, only the fragment differs
  assert.equal(go("#feed"), false);
  assert.equal(go(""), false);
});

test("other sites and non-page links are left alone", () => {
  assert.equal(go("https://example.org/home"), false);
  assert.equal(go("mailto:team@scicollab.net"), false);
  assert.equal(go("tel:+4912345"), false);
  assert.equal(go("javascript:void(0)"), false);
});

test("downloads and data routes never navigate, so they must not leave a loading screen behind", () => {
  for (const href of ["/api/events/ics", "/api/post-files/1", "/auth/callback", "/settings/export", "/you/cv/export?format=csv",
    "/you/publications/export", "/you/record/export", "/projects/p-1/files/d-1/download"]) {
    assert.equal(go(href), false, href);
  }
  assert.equal(go("/projects/p-1/files/d-1"), true);       // the viewer page itself is a real page
  assert.equal(go("/exports-guide"), true);                // only the exact route names are excluded
});

test("a link that opens elsewhere, downloads, or is modified-clicked is not a page change", () => {
  assert.equal(go("/groups", { target: "_blank" }), false);
  assert.equal(go("/groups", { download: true }), false);
  assert.equal(go("/groups", { modified: true }), false);
  assert.equal(go("/groups", { target: "_self" }), true);
});

test("a change is not finished while the address is unchanged, or while the grey placeholder is still up", () => {
  const base = { startedAt: "/groups", now: "/groups", placeholderShown: false };
  assert.equal(navigationFinished(base), false);                                           // still on the old page
  assert.equal(navigationFinished({ ...base, now: "/jobs", placeholderShown: true }), false);  // address changed at once, page not there yet
  assert.equal(navigationFinished({ ...base, now: "/jobs", placeholderShown: false }), true);  // the real page arrived
  assert.equal(navigationFinished({ ...base, now: "/groups?tab=data", placeholderShown: false }), true); // a tab or filter arrived
});
