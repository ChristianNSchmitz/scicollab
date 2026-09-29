/**
 * Create the demo accounts and seed enough real content that every wired
 * screen has something to show.
 *
 *   node scripts/seed-demo.mjs
 *
 * Idempotent: existing accounts are reused, and seeding is skipped if the
 * demo user already owns method cards.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

/* These are invented people. They were originally given real institutions,
   which reads as fabricated staff at organisations that exist — fine on a
   laptop, not on a public domain. Names carry an explicit marker and the
   institutions are placeholders that cannot be mistaken for real ones. */
/* The seed password is read from the environment rather than written here.
   This repository is mirrored into a public one, and a literal password in
   the source would let anyone sign in to the deployed site as a demo user. */
const PASSWORD = env.SCICOLLAB_SEED_PASSWORD;
if (!PASSWORD) {
  console.error("Set SCICOLLAB_SEED_PASSWORD in .env.local before seeding.");
  process.exit(1);
}

const PEOPLE = [
  { email: "demo@scicollab.test",      password: PASSWORD, display_name: "Alex Rivera (example)",  institution: "Example Lab · demo data",       role_title: "Postdoctoral researcher", field: "Cell biology",      techniques: ["transfection", "flow cytometry", "qPCR"] },
  { email: "okafor@scicollab.test",    password: PASSWORD, display_name: "T. Okafor (example)",    institution: "Example Institute · demo data", role_title: "Group leader",            field: "Molecular biology", techniques: ["lipofection", "CRISPR", "imaging"] },
  { email: "lindqvist@scicollab.test", password: PASSWORD, display_name: "M. Lindqvist (example)", institution: "Example Lab · demo data",       role_title: "Research engineer",       field: "Cell biology",      techniques: ["flow cytometry", "automation"] },
  { email: "bhatt@scicollab.test",     password: PASSWORD, display_name: "S. Bhatt (example)",     institution: "Example University · demo data", role_title: "PhD student",            field: "Biochemistry",      techniques: ["western blot", "transfection"] },
];

const ago = (d, h = 0) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();

async function ensureUser(p) {
  const { data, error } = await db.auth.admin.createUser({
    email: p.email, password: p.password, email_confirm: true,
    user_metadata: { display_name: p.display_name, institution: p.institution },
  });
  let id = data?.user?.id;
  if (error) {
    if (!/already|registered|exists/i.test(error.message)) throw error;
    const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
    id = list.users.find((u) => u.email === p.email)?.id;
    if (!id) throw new Error(`cannot resolve existing user ${p.email}`);
  }
  await db.from("profiles").upsert({
    id, display_name: p.display_name, institution: p.institution,
    role_title: p.role_title, field: p.field, techniques: p.techniques,
  });
  console.log(`  ${error ? "reused" : "created"}  ${p.email.padEnd(26)} ${id}`);
  return id;
}

console.log("accounts");
const id = {};
for (const p of PEOPLE) id[p.email.split("@")[0]] = await ensureUser(p);

const me = id.demo;
const { count } = await db.from("method_cards").select("id", { count: "exact", head: true }).eq("author_id", me);
if (count > 0) {
  console.log(`\ncontent already seeded (${count} cards owned by demo) — nothing to do`);
  process.exit(0);
}

console.log("\ncontent");

const card = async (row) => {
  const { data, error } = await db.from("method_cards").insert(row).select("id").single();
  if (error) throw error;
  return data.id;
};

const c0288 = await card({
  author_id: id.okafor, code: "MC-0288", version: 6,
  title: "Lipofection of HEK293T at low passage",
  method: "Lipofectamine 3000, 2.5 µg donor plasmid in 25 µL Opti-MEM. Serum-free at the dilution step only — carrying serum-free through incubation is the most common way to break this.",
  system: "H. sapiens · HEK293T (CVCL_0063)", conditions: "37 °C · 5% CO₂ · 48 h",
  outcome: "success", outcome_detail: "41 ± 3% at p < 12, across eight recorded runs.",
  fails_under: "Passage above 18 — efficiency falls to 4 ± 1%, and it is not recoverable by changing reagent lot. Serum-free medium carried through incubation drops it below 5%. CO₂ drift below 4.5% mimics the passage effect.",
  tags: ["transfection", "lipofection", "HEK293T"], visibility: "public",
  reproductions: 8, created_at: ago(39),
});

const c0412 = await card({
  author_id: me, code: "MC-0412", version: 4, forked_from: c0288,
  title: "Lipofection at high passage — efficiency collapse",
  method: "As MC-0288, run deliberately at p19–p24 to characterise the failure rather than avoid it.",
  system: "HEK293T · p19–p24", conditions: "37 °C · 5% CO₂ · 48 h",
  outcome: "negative", outcome_detail: "38% ± 6 at p12 falling to 4 ± 1% by p19. Below target in every replicate.",
  fails_under: "Passage above 18, or serum-free medium at transfection. Both tried, both below 5%. Recorded so nobody in this lab loses another week to it.",
  tags: ["transfection", "HEK293T", "passage number"], visibility: "public",
  reproductions: 2, created_at: ago(11),
});

await card({
  author_id: id.bhatt, code: "MC-0517", version: 1,
  title: "Anti-GFP western blot — signal loss above 100 kDa",
  method: "Wet transfer, 100 V for 60 min, 20% methanol in the transfer buffer.",
  system: "HEK293T lysate", conditions: "pH 8.3 · 20% MeOH · 60 min 100 V",
  outcome: "partial", outcome_detail: "Bands below 100 kDa are clean. Everything above is faint or absent.",
  fails_under: "20% methanol at high molecular weight. Untested below 10%.",
  tags: ["western blot", "transfer"], visibility: "public", created_at: ago(4),
});

await card({
  author_id: me, code: "MC-0602", version: 2,
  title: "CO₂ incubator drift check before blaming the cells",
  method: "Independent CO₂ meter logged hourly for 72 h against the incubator's own readout.",
  system: "Incubator · bay 3", conditions: "target 5% CO₂",
  outcome: "success", outcome_detail: "Incubator under-reads by 0.6% consistently. Logged before every transfection now.",
  fails_under: "Only valid for bay 3. The two other incubators drift the other way.",
  tags: ["equipment", "quality control"], visibility: "lab",
  reproductions: 1, created_at: ago(2),
});

await card({
  author_id: me, code: "MC-0733", version: 1,
  title: "Plasmid prep endotoxin threshold — unfinished",
  method: "Comparing two prep kits at matched yield.",
  system: "E. coli DH5α", tags: ["plasmid prep"], visibility: "private", created_at: ago(1),
});
console.log("  5 method cards");

const { data: q } = await db.from("questions").insert({
  author_id: me, method_card_id: c0412,
  title: "Transfection efficiency collapses above passage 18 — is this receptor loss or something I am doing?",
  body: "Three biological replicates, two reagent lots, fresh medium each time. MC-0288 holds perfectly below p12 and falls apart above p18. Reagent lot is not the variable — S. Bhatt ran L3K-2251 at p10 and got normal numbers.\n\nIs this a known receptor-density effect, or am I missing a step?",
  tags: ["transfection", "HEK293T", "passage number"], created_at: ago(10),
}).select("id").single();

await db.from("answers").insert([
  {
    question_id: q.id, author_id: id.okafor, accepted: true, votes: 12, created_at: ago(9),
    body: "Receptor loss, and it is cooperative — which is why it looks like a cliff rather than a slope. We characterised it on MC-0288 and it is not recoverable by reagent change.\n\nTwo things worth logging before you conclude anything: CO₂ drift below 4.5% produces almost exactly the same curve, and so does carrying serum-free medium through incubation. Rule both out first.",
  },
  {
    question_id: q.id, author_id: id.lindqvist, accepted: false, votes: 4, created_at: ago(8),
    body: "Adding the CO₂ drift case to the card cost us two months of misattribution, so I would check the incubator before the cells. Your MC-0602 is exactly the right shape for that.",
  },
]);
console.log("  1 question, 2 answers (one accepted)");

const { data: p1 } = await db.from("projects").insert({
  owner_id: me, title: "Transfection efficiency across passage number",
  summary: "Establishing where the cliff is, and whether it is recoverable. Feeds MC-0412.",
  tags: ["transfection", "HEK293T"], visibility: "lab", created_at: ago(30),
}).select("id").single();

const { data: p2 } = await db.from("projects").insert({
  owner_id: me, title: "Incubator qualification — all three bays",
  summary: "Quarterly drift check so equipment stops being a hidden variable.",
  tags: ["equipment"], visibility: "lab", created_at: ago(6),
}).select("id").single();

await db.from("project_members").insert([
  { project_id: p1.id, user_id: me, role: "owner" },
  { project_id: p1.id, user_id: id.lindqvist, role: "contributor" },
  { project_id: p2.id, user_id: me, role: "owner" },
]);

await db.from("eln_entries").insert([
  { project_id: p1.id, author_id: me, signed_at: ago(9), created_at: ago(9), body: "p19 run, triplicate. 4.2%, 3.8%, 4.4%. Matches p21 from last week — the cliff is real and it is not gradual." },
  { project_id: p1.id, author_id: me, signed_at: ago(7), created_at: ago(7), body: "Swapped to lot L3K-2251 at p19 to rule out reagent. 4.1%. Reagent is not the variable." },
  { project_id: p2.id, author_id: me, signed_at: ago(2), created_at: ago(2), body: "Bay 3 under-reads by 0.6% against the independent meter, stable across 72 h. Bays 1 and 2 drift the other way." },
]);
console.log("  2 projects, 3 notebook entries");

await db.from("messages").insert([
  { sender_id: id.okafor, recipient_id: me, read_at: ago(9), created_at: ago(9, 2), body: "Saw your null result on MC-0412. We are about to run the same passage comparison — can I see the raw gating before we start?" },
  { sender_id: me, recipient_id: id.okafor, method_card_id: c0412, read_at: ago(9), created_at: ago(9, 1), body: "Yes — here is the card. It is Lab visibility, so this grants you read access as an individual, not to your whole group." },
  { sender_id: id.okafor, recipient_id: me, created_at: ago(8), body: "Perfect. I will record our run against it either way, including if it disagrees with yours." },
]);
console.log("  3 messages");

console.log("\nsign in at http://localhost:4400/login");
console.log("  demo@scicollab.test / reproduce");
