/** Join the demo accounts to rooms and seed a few posts, so the feed on the
 *  real database looks like the demo store. Idempotent. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 });
const id = (e) => list.users.find((u) => u.email === e)?.id;
const demo = id("demo@scicollab.test"), okafor = id("okafor@scicollab.test"),
      bhatt = id("bhatt@scicollab.test"), lind = id("lindqvist@scicollab.test");
if (!demo) { console.error("seed the accounts first: node scripts/seed-demo.mjs"); process.exit(1); }

const memberships = [
  [demo, "western-blot"], [demo, "transfection"], [demo, "negative-results"], [demo, "cell-culture"], [demo, "grants-careers"],
  [okafor, "transfection"], [okafor, "negative-results"],
  [bhatt, "western-blot"], [lind, "instruments"],
];
await db.from("user_rooms").upsert(
  memberships.map(([user_id, room_id]) => ({ user_id, room_id })),
  { onConflict: "user_id,room_id" }
);
console.log(`rooms joined: ${memberships.length}`);

const { count } = await db.from("posts").select("id", { count: "exact", head: true });
if (count > 0) { console.log(`posts already seeded (${count}) — nothing to do`); process.exit(0); }

const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const { data: cards } = await db.from("method_cards").select("id, code");
const card = (code) => cards.find((c) => c.code === code)?.id ?? null;

await db.from("posts").insert([
  { author_id: demo, room_id: "negative-results", intent: "result", created_at: ago(11),
    title: "Transfection efficiency falls off a cliff above passage 18, not a slope",
    body: "Posting the negative result rather than sitting on it. Three biological replicates, two reagent lots. The shape matters: it is not gradual, which is why people keep blaming the reagent.",
    method_card_id: card("MC-0412") },
  { author_id: demo, room_id: "cell-culture", intent: "data_question", created_at: ago(2),
    title: "Is my CO₂ drift big enough to explain a 30% efficiency loss?",
    body: "Bay 3 under-reads by 0.6%. I cannot tell if it accounts for the whole loss or only part of it. Card has the logging run.",
    method_card_id: card("MC-0602") },
  { author_id: bhatt, room_id: "western-blot", intent: "data_question", created_at: ago(4),
    title: "High-MW bands gone at 20% methanol — how far down can I go?",
    body: "Everything below 100 kDa is clean. Standard advice is to drop the methanol but nobody records what it costs at the low end.",
    method_card_id: card("MC-0517") },
  { author_id: okafor, room_id: "transfection", intent: "collab", created_at: ago(6),
    title: "Looking for a second lab to run the passage comparison independently",
    body: "We have the protocol and the analysis; what we do not have is an independent replication. Happy for the null result if that is what comes out.",
    method_card_id: card("MC-0288"),
    technique: "Lipofection", organism: "HEK293T",
    deadline: new Date(Date.now() + 45 * 864e5).toISOString().slice(0, 10),
    offer: "Co-authorship, reagents covered, analysis shared" },
  { author_id: lind, room_id: "grants-careers", intent: "general", created_at: ago(8),
    title: "Has anyone moved from a research-engineer post into a staff-scientist track?",
    body: "Asking for the practical version rather than the official one — what actually counted when you applied." },
]);
console.log("posts seeded: 5");
