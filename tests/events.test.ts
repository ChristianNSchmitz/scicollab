import { test } from "node:test";
import assert from "node:assert/strict";
import { localToUtc, icsFor } from "../lib/events.ts";

test("a local time becomes UTC, summer and winter", () => {
  assert.equal(localToUtc("2026-11-12T16:00", "Europe/Berlin"), "2026-11-12T15:00:00.000Z");
  assert.equal(localToUtc("2026-07-01T09:30", "Europe/Berlin"), "2026-07-01T07:30:00.000Z");
  assert.equal(localToUtc("2026-07-01T09:30", "America/New_York"), "2026-07-01T13:30:00.000Z");
  assert.equal(localToUtc("2026-07-01T09:30", "Nowhere/Else"), "2026-07-01T09:30:00.000Z");
  assert.equal(localToUtc("tomorrow", "Europe/Berlin"), null);
});

test("an iCalendar file escapes text and folds long lines", () => {
  const ics = icsFor([{ id: "e1", group_id: null, kind: "talk", title: "Gating, again; with commas", starts_at: "2026-11-12T15:00:00.000Z", ends_at: null,
    location: "Room 2", online_url: "", body: "x".repeat(200), created_by: "u", created_at: "" }], "https://scicollab.net");
  assert.match(ics, /BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /SUMMARY:Gating\\, again\; with commas/);
  assert.match(ics, /DTSTART:20261112T150000Z/);
  assert.match(ics, /DTEND:20261112T160000Z/);
  assert.ok(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75));
});
