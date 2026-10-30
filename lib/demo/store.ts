/**
 * Demo store — an in-memory stand-in for the database.
 *
 * It exists so the platform can be walked end to end without a backend: every
 * wired screen renders with realistic content and every write works for the
 * life of the dev server. Nothing here is persisted; restarting resets it.
 *
 * Enabled when SCICOLLAB_DEMO=1, or automatically when no Supabase URL is
 * configured. The Supabase path is untouched either way.
 *
 * One seeded world: a small community three months into a beta — the five
 * researchers written for the demo, the people from the design boards and the
 * moderation team (lib/demo/personas). Every invented member's name ends in
 * ".ex". The written content is lib/demo/personas/content.json.
 */

import { PERSONA_ACCOUNTS, ACCOUNT_ALIASES, personaTables } from "./personas";

export type Visibility = "private" | "lab" | "public";

/** The board's researcher persona, now Alex Rivera.ex. Kept as an id other modules use. */
export const ME = "u-rivera";
export const DEMO_EMAIL = "demo@scicollab.test";
export const DEMO_PASSWORD = "reproduce";

/* Seeded sign-ins. Not secrets: this store has no real data in it and exists
   so the app runs without a backend. Each member has their own password so
   the team can sign in as one of them and carry the story on. */
const credentials = new Map<string, string>(
  [...PERSONA_ACCOUNTS, ...ACCOUNT_ALIASES].map((a) => [a.email, a.password] as [string, string])
);
const emailToId = new Map<string, string>(
  [...PERSONA_ACCOUNTS, ...ACCOUNT_ALIASES].map((a) => [a.email, a.id] as [string, string])
);

/** Seeded accounts other people rely on; deleting one would break the demo for everyone. */
export function isSeededAccount(id: string): boolean {
  return PERSONA_ACCOUNTS.some((a) => a.id === id);
}

export function authenticate(email: string, password: string): string | null {
  const addr = email.trim().toLowerCase();
  const known = credentials.get(addr);
  return known && known === password ? emailToId.get(addr)! : null;
}

/** Sign-up in demo mode: a real profile, held in memory until restart. */
export function register(email: string, password: string, display_name: string, institution: string): string {
  const addr = email.trim().toLowerCase();
  const id = `u-${Math.random().toString(36).slice(2, 9)}`;
  // Into the pinned table, not a module-local array: a second copy of this
  // module would otherwise write somewhere nobody reads.
  (tables.profiles as Record<string, unknown>[]).push({
    id, display_name: display_name || addr.split("@")[0], institution,
    role_title: "", field: "", orcid: null, techniques: [], email: addr,
    bio: "", notifications_seen_at: null, weekly_digest: true, public_profile: false, avatar_url: null,
    created_at: new Date().toISOString(),
  });
  credentials.set(addr, password);
  emailToId.set(addr, id);
  return id;
}

/** Demo: change a member's password, after checking the current one. */
export function changeDemoPassword(id: string, current: string, next: string): boolean {
  for (const [email, uid] of emailToId) {
    if (uid !== id) continue;
    if (credentials.get(email) !== current) return false;
    credentials.set(email, next);
    return true;
  }
  return false;
}

export function emailTaken(email: string): boolean {
  return credentials.has(email.trim().toLowerCase());
}

/* ── raw table access ─────────────────────────────────────────────────────
   The demo client shim queries these by name, exactly as PostgREST would.

   Pinned on globalThis deliberately. These arrays are mutable module state,
   and Next.js can instantiate a module more than once — a server action and
   the page that re-renders after it do not reliably share one copy. Without
   this, a write lands in one instance and the read happens in another, so
   the change appears to succeed and then vanishes. Pinning gives every
   instance the same tables. */
const __sc = globalThis as { __scicollabTables?: Record<string, Record<string, unknown>[]> };

export const tables: Record<string, Record<string, unknown>[]> =
  (__sc.__scicollabTables ??= personaTables());

/** Account deletion in demo mode: the sign-in, the profile and every row the
 *  person authored or received, removed in place so other references to the
 *  same arrays stay valid. */
const OWNER_COLUMNS = ["author_id", "owner_id", "user_id", "sender_id", "recipient_id", "requester_id", "mentee_id", "mentor_id",
  "follower_id", "followee_id", "mentioned_id", "created_by", "added_by", "reporter_id"];
export function forget(id: string): void {
  for (const [email, uid] of emailToId) if (uid === id) { emailToId.delete(email); credentials.delete(email); }
  for (const rows of Object.values(tables)) {
    for (let i = rows.length - 1; i >= 0; i--) {
      const r = rows[i] as Record<string, unknown>;
      if (rows === (tables.profiles as unknown) && r.id === id) { rows.splice(i, 1); continue; }
      if (OWNER_COLUMNS.some((c) => r[c] === id)) rows.splice(i, 1);
    }
  }
}
