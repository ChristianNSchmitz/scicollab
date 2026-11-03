/**
 * Load the invented demo community into the real Supabase database, so the
 * deployed site shows it: the 12 members whose names end in ".ex", their
 * posts, replies, questions, private chats, method cards, projects and groups
 * (the same world as lib/demo/personas, which only the in-memory demo uses).
 *
 *   node scripts/seed-personas.mjs                  dry run: shows what it would write
 *   node scripts/seed-personas.mjs --yes            writes it
 *   node scripts/seed-personas.mjs --remove         dry run of the removal
 *   node scripts/seed-personas.mjs --remove --yes   deletes everything it wrote
 *
 * Needs in .env.local (or in the environment):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   SCICOLLAB_PERSONA_PASSWORD   one password for the 12 accounts, 12+ characters.
 *                                The README passwords are public and are never used here.
 *
 * Safe to run again: every row gets a fixed id derived from its demo id, rows
 * and profiles already there are left as they are (edits made on the site
 * stay), and new rows (for example a week added to content.json) are added. --remove deletes the 12 accounts; everything they
 * own goes with them (every table cascades from auth.users), plus their files.
 * Replies that real members wrote on persona posts are deleted with those posts.
 *
 * What differs from the local demo, on purpose, because this is a public site:
 *   - every profile says it is invented, is visible to signed-in members only,
 *     gets no e-mail digest (the addresses are @scicollab.test) and has no ORCID;
 *   - not loaded: the moderation role (an account with a public password must not
 *     moderate real members), the two invented reports, and the GitHub, GitLab and
 *     Nextcloud links (the live site fetches those; the addresses are placeholders);
 *   - data and code files show as records only: the live database has no column for
 *     the demo files, so they cannot be opened there.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import ts from "typescript";

const args = new Set(process.argv.slice(2));
const REMOVE = args.has("--remove");
const WRITE = args.has("--yes");

// ── settings ──────────────────────────────────────────────────────────────
const LABEL = "Invented demo member, not a real person.";
const SKIP = new Set([
  "moderators", "reports", "repo_links", "nextcloud_links", "nextcloud_secrets",
  // empty in the demo world, or written by the app itself
  "mentions", "group_requests", "group_invites", "group_visits", "saved_posts", "feed_mutes",
  "citation_snapshots", "openalex_authors", "publications", "sync_runs",
]);
/** Columns the demo store has and the database does not. */
const DROP = {
  profiles: ["email"], project_members: ["created_at"], datasets: ["file_path"], code_files: ["file_path"],
  project_methods: ["id"], post_reposts: ["id"], post_audience: ["id"], call_interest: ["id"], chat_room_members: ["id"],
};
/** Primary keys, for "insert unless already there". */
const KEYS = {
  project_members: "project_id,user_id", card_reads: "card_id,week,reader_key", recommendations: "card_id,user_id",
  user_rooms: "user_id,room_id", follows: "follower_id,followee_id", group_members: "group_id,user_id",
  group_projects: "group_id,project_id", group_methods: "group_id,card_id", group_datasets: "group_id,dataset_id",
  post_reposts: "post_id,user_id", post_audience: "post_id,user_id", call_interest: "post_id,user_id",
  chat_room_members: "room_id,user_id", project_methods: "project_id,card_id",
};
/** Insert order: everything a row points at is written before it. */
const ORDER = [
  "method_cards", "questions", "answers", "projects", "project_members", "eln_entries", "datasets",
  "code_files", "code_commits", "groups", "group_members", "group_projects", "group_methods",
  "group_messages", "group_notes", "group_tasks", "group_datasets", "group_files", "posts",
  "post_replies", "post_attachments", "access_requests", "post_reposts", "post_audience", "post_files",
  "call_interest", "chat_rooms", "chat_room_members", "chat_room_messages", "messages", "user_rooms",
  "reproductions", "reviews", "recommendations", "mentorships", "card_reads", "follows", "reactions",
  "project_methods", "project_milestones",
];
/** Which table a reference column points at ("users" = the accounts). */
const USERS = "users";
const REFS = {
  author_id: USERS, owner_id: USERS, user_id: USERS, sender_id: USERS, recipient_id: USERS,
  reviewer_id: USERS, mentor_id: USERS, mentee_id: USERS, follower_id: USERS, followee_id: USERS,
  created_by: USERS, added_by: USERS, uploaded_by: USERS, assignee_id: USERS, done_by: USERS,
  requester_id: USERS, reporter_id: USERS, resolved_by: USERS, mentioned_id: USERS,
  method_card_id: "method_cards", card_id: "method_cards", forked_from: "method_cards", method_id: "method_cards",
  post_id: "posts", project_id: "projects", group_id: "groups", question_id: "questions",
  dataset_id: "datasets", code_file_id: "code_files", attachment_id: "post_attachments",
};
/** Files kept inline in the demo, and where the live site keeps them. */
const BUCKETS = { post_files: ["post-files", "post_id"], group_files: ["group-files", "group_id"] };

// ── environment ───────────────────────────────────────────────────────────
const envFile = new URL("../.env.local", import.meta.url);
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(readFileSync(envFile, "utf8").split(/\r?\n/).filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
      .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }))
  : {};
const env = (k) => process.env[k] || fileEnv[k] || "";
const URL_ = env("NEXT_PUBLIC_SUPABASE_URL"), KEY = env("SUPABASE_SERVICE_ROLE_KEY"), PASSWORD = env("SCICOLLAB_PERSONA_PASSWORD");

// ── the demo world, exactly as the local demo builds it ───────────────────
async function loadWorld() {
  const src = readFileSync(new URL("../lib/demo/personas/index.ts", import.meta.url), "utf8");
  const json = readFileSync(new URL("../lib/demo/personas/content.json", import.meta.url), "utf8");
  let js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  const importLine = /^import content from ["']\.\/content\.json["'];?\s*$/m;
  if (!importLine.test(js)) throw new Error("lib/demo/personas/index.ts no longer imports ./content.json as expected");
  js = js.replace(importLine, `const content = ${json};`);
  const dir = mkdtempSync(join(tmpdir(), "scicollab-personas-"));
  try {
    const file = join(dir, "personas.mjs");
    writeFileSync(file, js);
    const mod = await import(pathToFileURL(file).href);
    return { tables: mod.personaTables(), accounts: mod.PERSONA_ACCOUNTS, readmePasswords: mod.PERSONA_ACCOUNTS.map((a) => a.password) };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ── fixed ids: the same demo row always becomes the same database row ─────
const NAMESPACE = Buffer.from("6f1c3b0e6b9a4f5e9a512d8c1e7a9b40", "hex");
function uuid5(name) {
  const h = createHash("sha1").update(NAMESPACE).update(name).digest();
  h[6] = (h[6] & 0x0f) | 0x50; h[8] = (h[8] & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}
const idOf = (kind, demoId) => uuid5(`scicollab-persona:${kind}:${demoId}`);

/** The table a column of `table` points at, or null for plain values. */
function refKind(table, col, row) {
  if (col === "id") return table === "profiles" ? USERS : table;
  if (col === "target_id" && table === "reactions") return row.target_kind === "post" ? "posts" : "answers";
  if (col === "room_id") return table === "chat_room_members" || table === "chat_room_messages" ? "chat_rooms" : null; // posts: a room name
  return REFS[col] ?? null;
}

/** Demo rows → database rows: fixed ids, demo-only columns removed, the live-site rules applied. */
function prepare(world, liveColumns) {
  const { tables, accounts } = world;
  const userIds = new Set(accounts.map((a) => a.id));
  const out = {}, dropped = [];
  const known = {};                                                  // demo ids present, per table
  for (const [t, rows] of Object.entries(tables)) known[t] = new Set(rows.map((r) => r.id));
  known[USERS] = userIds;

  for (const table of ORDER) {
    const rows = tables[table] ?? [];
    if (!rows.length || SKIP.has(table)) continue;
    if (liveColumns && !liveColumns[table]) { dropped.push(`${table}: whole table (${rows.length} rows) — not in the live database`); continue; }
    let list = [];
    for (const r of rows) {
      // A row pointing at something that is not in the seed would fail the insert.
      const missing = Object.entries(r).find(([c, v]) => v && c !== "id" && refKind(table, c, r) && !known[refKind(table, c, r)]?.has(v));
      if (missing) { dropped.push(`${table} ${r.id ?? ""}: points at ${missing[1]}, which is not seeded`); continue; }
      const row = {};
      for (const [c, v] of Object.entries(r)) {
        if (DROP[table]?.includes(c)) continue;
        if (liveColumns && !liveColumns[table].has(c)) continue;
        const kind = refKind(table, c, r);
        row[c] = kind && v ? idOf(kind, v) : v;
      }
      if (table === "method_cards") row.reproductions = 0;          // the database counts them as they are inserted
      list.push({ demo: r, row });
    }
    if (table === "method_cards") {                                  // a fork after the card it comes from
      const depth = (r) => { let d = 0, p = r.forked_from; while (p && d < 20) { d++; p = rows.find((x) => x.id === p)?.forked_from; } return d; };
      list.sort((a, b) => depth(a.demo) - depth(b.demo));
    }
    out[table] = list;
  }

  const profiles = (tables.profiles ?? []).map((p) => {
    const row = {};
    for (const [c, v] of Object.entries(p)) if (!DROP.profiles.includes(c) && c !== "id" && (!liveColumns?.profiles || liveColumns.profiles.has(c))) row[c] = v;
    return { demo: p, uid: idOf(USERS, p.id), row: Object.assign(row, {
      bio: p.bio ? `${LABEL} ${p.bio}` : LABEL, public_profile: false, weekly_digest: false, orcid: null,
    }) };
  });
  for (const p of profiles) for (const c of Object.keys(p.row)) if (liveColumns?.profiles && !liveColumns.profiles.has(c)) delete p.row[c];
  const weeksBack = notInTheFuture([...Object.values(out).flat().map((p) => p.row), ...profiles.map((p) => p.row)]);
  return { tables: out, profiles, dropped, weeksBack };
}

/**
 * The demo moves its dates forward in whole weeks so the newest item looks
 * recent; a few items can then land a few days ahead of today. A real
 * database must not hold posts from the future, so everything moves back by
 * whole weeks until the newest item is in the past. Weekdays stay weekdays.
 */
function notInTheFuture(rows, now = Date.now()) {
  const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, DAY = /^\d{4}-\d{2}-\d{2}$/, WEEK = 7 * 864e5;
  let newest = 0;
  for (const r of rows) for (const v of Object.values(r)) if (typeof v === "string" && ISO.test(v)) newest = Math.max(newest, Date.parse(v));
  const weeks = newest > now ? Math.ceil((newest - now) / WEEK) : 0;
  if (!weeks) return 0;
  for (const r of rows) for (const [k, v] of Object.entries(r)) {
    if (typeof v !== "string") continue;
    if (ISO.test(v)) r[k] = new Date(Date.parse(v) - weeks * WEEK).toISOString();
    else if (DAY.test(v)) r[k] = new Date(Date.parse(`${v}T12:00:00Z`) - weeks * WEEK).toISOString().slice(0, 10);
  }
  return weeks;
}

/** Where a file row's content goes in storage, and its bytes. */
function storageItem(table, prepared) {
  const [bucket, parentCol] = BUCKETS[table];
  const { demo, row } = prepared;
  const m = /^data:([^;,]+);base64,(.*)$/s.exec(demo.path ?? "");
  if (!m) return null;
  return { bucket, path: `${row[parentCol]}/${row.id}/${demo.name}`, mime: m[1], bytes: Buffer.from(m[2], "base64") };
}

/** Table → its columns on the live database, from the REST API's own description. */
async function liveSchema() {
  try {
    // Newer Supabase secret keys ("sb_secret_…") go in the apikey header only.
    const headers = { apikey: KEY, Accept: "application/openapi+json", ...(KEY.startsWith("sb_") ? {} : { Authorization: `Bearer ${KEY}` }) };
    const res = await fetch(`${URL_.replace(/\/$/, "")}/rest/v1/`, { headers });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const spec = await res.json();
    return Object.fromEntries(Object.entries(spec.definitions ?? {}).map(([t, d]) => [t, new Set(Object.keys(d.properties ?? {}))]));
  } catch (e) {
    console.warn(`  (could not read the live table list: ${e.message}; writing every column as is)`);
    return null;
  }
}

const say = (s = "") => console.log(s);
const fail = (s) => { console.error(`\nSTOPPED: ${s}`); process.exit(1); };

// ── main ──────────────────────────────────────────────────────────────────
const world = await loadWorld();
const accounts = world.accounts;
say(`SciCollab demo community → live database  (${REMOVE ? "REMOVE" : "LOAD"}, ${WRITE ? "writing" : "dry run, nothing is written"})`);

if (!URL_ || !KEY) {
  if (WRITE) fail("set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  const { tables, profiles, dropped } = prepare(world, null);
  say(`No database settings found, so this is the offline plan only.\n  accounts: ${profiles.length}`);
  for (const [t, l] of Object.entries(tables)) say(`  ${t}: ${l.length}`);
  for (const d of dropped) say(`  not loaded — ${d}`);
  process.exit(0);
}
say(`Database: ${new URL(URL_).host}`);
const db = createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function existingUsers() {
  const found = new Map();
  for (let page = 1; page < 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail(`cannot list accounts: ${error.message}`);
    for (const u of data.users) found.set(u.email?.toLowerCase(), u.id);
    if (data.users.length < 1000) break;
  }
  return found;
}

if (REMOVE) {
  const users = await existingUsers();
  const ours = accounts.map((a) => ({ ...a, uid: idOf(USERS, a.id) })).filter((a) => users.get(a.email) === a.uid);
  const foreign = accounts.filter((a) => users.has(a.email) && users.get(a.email) !== idOf(USERS, a.id));
  for (const a of foreign) say(`  left alone: ${a.email} exists but was not created by this script`);
  say(`Accounts created by this script: ${ours.length} of ${accounts.length}`);
  if (!WRITE) { say("Dry run. Add --yes to delete them and everything they own."); process.exit(0); }
  const { tables } = prepare(world, null);
  for (const table of Object.keys(BUCKETS)) {
    const items = (tables[table] ?? []).map((p) => storageItem(table, p)).filter(Boolean);
    for (const bucket of new Set(items.map((i) => i.bucket))) {
      const paths = items.filter((i) => i.bucket === bucket).map((i) => i.path);
      const { error } = await db.storage.from(bucket).remove(paths);
      say(`  files in ${bucket}: ${error ? `not removed (${error.message})` : `${paths.length} removed`}`);
    }
  }
  for (const a of ours) {
    const { error } = await db.auth.admin.deleteUser(a.uid);
    if (error) fail(`could not delete ${a.email}: ${error.message}`);
  }
  // Check: nothing left that this script wrote.
  let left = 0;
  for (const [table, list] of Object.entries(tables)) {
    const ids = list.map((p) => p.row.id).filter(Boolean);
    let n = 0;
    for (let i = 0; i < ids.length; i += 100) {
      const { count } = await db.from(table).select("id", { count: "exact", head: true }).in("id", ids.slice(i, i + 100));
      n += count ?? 0;
    }
    if (n) { left += n; say(`  still there: ${n} row(s) in ${table}`); }
  }
  say(left ? "Removed the accounts, but some rows are left (see above)." : `DONE. Removed ${ours.length} accounts and everything they owned.`);
  process.exit(left ? 1 : 0);
}

// LOAD
if (WRITE && PASSWORD.length < 12) fail("set SCICOLLAB_PERSONA_PASSWORD in .env.local (12 characters or more)");
if (WRITE && world.readmePasswords.includes(PASSWORD)) fail("SCICOLLAB_PERSONA_PASSWORD must not be one of the README passwords: those are public");

const liveColumns = await liveSchema();
const { tables, profiles, dropped, weeksBack } = prepare(world, liveColumns);
const users = await existingUsers();
if (weeksBack) say(`Dates: moved back ${weeksBack} week(s), so nothing is dated in the future.`);
for (const p of profiles) {
  const have = users.get(emailOf(p.demo.id));
  if (have && have !== p.uid) fail(`${emailOf(p.demo.id)} already exists on the live site and was not created by this script. Nothing was written.`);
}
function emailOf(demoId) { return accounts.find((a) => a.id === demoId).email; }

say(`Accounts: ${profiles.length} (${profiles.filter((p) => users.has(emailOf(p.demo.id))).length} already there)`);
for (const [t, l] of Object.entries(tables)) say(`  ${t}: ${l.length}`);
for (const d of dropped) say(`  not loaded — ${d}`);
if (!WRITE) { say("\nDry run. Add --yes to write this to the database above."); process.exit(0); }

say("\nWriting...");
for (const p of profiles) {
  const email = emailOf(p.demo.id);
  if (!users.has(email)) {
    const { data, error } = await db.auth.admin.createUser({
      id: p.uid, email, password: PASSWORD, email_confirm: true,
      user_metadata: { display_name: p.row.display_name, institution: p.row.institution },
    });
    if (error) fail(`could not create ${email}: ${error.message}`);
    if (data.user?.id !== p.uid) {                                   // every row points at this id
      await db.auth.admin.deleteUser(data.user.id);
      fail(`the database did not accept the fixed id for ${email}; nothing else was written for it`);
    }
  }
  // Filled in once: a filled profile carries its months-old join date, a new one today's.
  // A profile someone edited since, while playing the role, is left as it is.
  const { data: cur } = await db.from("profiles").select("created_at").eq("id", p.uid).maybeSingle();
  if (cur && Date.now() - Date.parse(cur.created_at) > 864e5) continue;
  const { error } = await db.from("profiles").update(p.row).eq("id", p.uid);
  if (error) fail(`profile of ${email}: ${error.message}`);
}
say(`  accounts and profiles: ${profiles.length}`);

for (const [table, list] of Object.entries(tables)) {
  if (BUCKETS[table]) {
    for (const p of list) {
      const item = storageItem(table, p);
      if (!item) continue;
      const { error } = await db.storage.from(item.bucket).upload(item.path, item.bytes, { contentType: item.mime, upsert: true });
      if (error) fail(`file ${p.demo.name} (${table}): ${error.message}`);
      p.row.path = item.path;
    }
  }
  const rows = list.map((p) => p.row);
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 200), { onConflict: KEYS[table] ?? "id", ignoreDuplicates: true });
    if (error) fail(`${table}: ${error.message}${error.details ? ` (${error.details})` : ""}\nRows written so far stay. Fix the cause and run again, or undo with --remove --yes.`);
  }
  say(`  ${table}: ${rows.length}`);
}
say(`\nDONE. Sign in on the live site as any member, for example ${accounts[0].email}, with SCICOLLAB_PERSONA_PASSWORD.`);
