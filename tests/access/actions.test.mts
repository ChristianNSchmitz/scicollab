/**
 * P0 access tests — every server action.
 *
 * 1. Signed out: every exported action (found automatically, so new ones are
 *    covered too) writes nothing and is refused — except the PUBLIC list.
 * 2. Owner vs stranger (cases.mts): the person allowed to act really changes
 *    something; a signed-in member with no link to the target changes nothing.
 *
 * KNOWN_GAPS are real holes in the code. They are marked "todo": they run and
 * are reported, but do not turn the build red until someone decides on a fix.
 * Remove a line from KNOWN_GAPS once its fix is in.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { reset, as, attempt, refused, form } from "./harness.mts";
import { CASES, STRANGER } from "./cases.mts";

/** Meant for visitors who are not signed in. */
const PUBLIC = new Set([
  "contact.sendContact", "signup.createAccount", "password.requestPasswordReset",
  "demo-auth.demoSignIn", "demo-auth.demoSignUp", "demo-auth.demoSignOut", "demo-auth.signOut", "demo-auth.backendConfigured",
]);

/**
 * The code checks nothing itself and leaves it to the Supabase database rule
 * (RLS). Safe on Supabase today; open in the demo store, and open again on any
 * database without those rules.
 */
const RLS_ONLY = "relies on the Supabase database rule only (the code does not check); open in demo mode and after a database move";
const KNOWN_GAPS: Record<string, string> = {
  "post-interactions.setSaved (post shared with named people only)": `${RLS_ONLY} — posts_read, supabase/15-early-career.sql`,
  "cards.forkCard (someone else's private card)": `${RLS_ONLY} — cards_read, supabase/schema.sql; the copy carries the private card's text`,
  "record.recordReproduction (someone else's private card)": `${RLS_ONLY} — cards_read, supabase/schema.sql`,
  "record.writeReview (someone else's private card)": `${RLS_ONLY} — cards_read, supabase/schema.sql`,
  "record.toggleRecommendation (someone else's private card)": `${RLS_ONLY} — cards_read, supabase/schema.sql`,
};

// ── 1. signed out ───────────────────────────────────────────────────────────
const dir = new URL("../../app/actions/", import.meta.url);
const anyForm = () => form({ title: "T", body: "B", name: "N", email: "x.ex@scicollab.test", password: "longpassword1", message: "m", note: "n", person: "u-jonas", people: "u-jonas", role: "member", status: "closed", visibility: "public", outcome: "held", verdict: "clear", reason: "spam", confirm: "DELETE", display_name: "X.ex" });
for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts")).sort()) {
  const mod = await import(new URL(file, dir).href);
  for (const [name, fn] of Object.entries(mod)) {
    if (typeof fn !== "function") continue;
    const id = `${file.replace(/\.ts$/, "")}.${name}`;
    if (PUBLIC.has(id)) continue;
    test(`signed out: ${id} is refused`, async () => {
      reset(); as(undefined);
      const n = Math.max((fn as Function).length, 1);
      const args = Array.from({ length: n }, (_, i) => (i === n - 1 ? anyForm() : ["p-1", "c-0412", "gr-ebro"][i] ?? "x"));
      const o = await attempt(() => (fn as Function)(...args));
      assert.deepEqual(o.changed, [], "wrote to the store while signed out");
      const emptyView = o.value && typeof o.value === "object" && Object.values(o.value as object).every((v) => !Array.isArray(v) || v.length === 0);
      assert.ok(refused(o) || emptyView, `not refused: ${JSON.stringify(o).slice(0, 200)}`);
    });
  }
}

// ── 2. owner vs stranger ────────────────────────────────────────────────────
for (const c of CASES) {
  const todo = KNOWN_GAPS[c.name];
  if (c.owner) test(`allowed: ${c.name} works for ${c.owner}`, async () => {
    reset(); c.setup?.(); as(c.owner);
    const o = await attempt(c.run);
    if (c.read) assert.ok(!refused(o), `refused: ${JSON.stringify(o).slice(0, 200)}`);
    else assert.ok(o.changed.length > 0, `changed nothing: ${JSON.stringify(o).slice(0, 200)}`);
  });
  if (c.stranger === "self") continue;
  test(`${c.stranger === "deny" ? "refused" : "allowed"}: ${c.name} for a member with no link (${STRANGER})`, { todo }, async () => {
    reset(); c.setup?.(); as(STRANGER);
    const o = await attempt(c.run);
    if (c.stranger === "deny") {
      if (c.read) assert.ok(refused(o) || (Array.isArray(o.value) && o.value.length === 0), `returned data: ${JSON.stringify(o.value).slice(0, 200)}`);
      else assert.ok(refused(o), `not refused: ${JSON.stringify(o).slice(0, 200)}`);
    } else assert.ok(o.changed.length > 0, `changed nothing: ${JSON.stringify(o).slice(0, 200)}`);
  });
  test(`signed out: ${c.name} is refused`, async () => {
    reset(); c.setup?.(); as(undefined);
    assert.ok(refused(await attempt(c.run)));
  });
}
