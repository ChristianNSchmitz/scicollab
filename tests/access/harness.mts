/**
 * Test harness for access rules, run against the in-memory demo store.
 *
 * `as(user)` sets who is signed in (undefined = signed out). `attempt()` runs
 * a server action or route and reports what happened: where the person was
 * sent, whether it returned an error, and which tables changed. Every test
 * starts from the same seeded store (`reset()`).
 */
import { tables } from "../../lib/demo/store.ts";
import { Redirect, NotFound } from "./mocks/navigation.mjs";

// No test may reach the network (ORCID, OpenAlex, mail). A call that tries fails.
globalThis.fetch = (async () => { throw new Error("network disabled in tests"); }) as typeof fetch;

const pristine = structuredClone(tables);

export function reset() {
  for (const k of Object.keys(tables)) if (!(k in pristine)) delete tables[k];
  for (const [k, rows] of Object.entries(pristine)) {
    const live = (tables[k] ??= []);
    live.splice(0, live.length, ...structuredClone(rows));
  }
  (globalThis as any).__cookieJar = new Map();
  (globalThis as any).__scShowcase = undefined;
  as(undefined);
}

export function as(user: string | undefined) { (globalThis as any).__asUser = user; }

const snapshot = () => Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, JSON.stringify(v)]));

export type Outcome = {
  redirect?: string; notFound?: boolean; error?: string; value?: unknown;
  changed: string[];
};

export async function attempt(fn: () => unknown): Promise<Outcome> {
  const before = snapshot();
  const out: Outcome = { changed: [] };
  try { out.value = await fn(); }
  catch (e: any) {
    if (e instanceof Redirect) out.redirect = e.url;
    else if (e instanceof NotFound) out.notFound = true;
    else out.error = String(e?.message ?? e);
  }
  const after = snapshot();
  out.changed = Object.keys({ ...before, ...after }).filter((k) => before[k] !== after[k]);
  return out;
}

/** A form with the fields actions read, filled with plausible values. */
export function form(fields: Record<string, string | Blob | string[]> = {}) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const one of Array.isArray(v) ? v : [v]) f.append(k, one as any);
  return f;
}

/** What a refusal looks like: nothing written, and either sent away or told no. */
export function refused(o: Outcome) {
  if (o.changed.length) return false;
  if (o.redirect !== undefined || o.notFound) return true;
  const v = o.value as any;
  if (v == null || v === false || v === 0) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return v.ok === false || "error" in v || !!v.error || v.allowed === false || Object.keys(v).length === 0;
  return false;
}

export { tables };
