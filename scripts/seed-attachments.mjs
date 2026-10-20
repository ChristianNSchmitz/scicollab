/** One attachment of each disclosure mode on the real database, plus a
 *  pending request, so both halves of the rule are visible. Idempotent. */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=")).map((l) => {
      const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { count } = await db.from("post_attachments").select("id", { count: "exact", head: true });
if (count > 0) { console.log(`attachments already seeded (${count}) — nothing to do`); process.exit(0); }

const { data: users } = await db.auth.admin.listUsers({ perPage: 1000 });
const id = (e) => users.users.find((u) => u.email === e)?.id;
const me = id("demo@scicollab.test"), okafor = id("okafor@scicollab.test");

const { data: posts } = await db.from("posts").select("id, title, intent, author_id");
const negative = posts.find((p) => /passage 18/i.test(p.title));
const question = posts.find((p) => /CO₂ drift|CO2 drift/i.test(p.title));

const { data: datasets } = await db.from("datasets").select("id, title, project_id");
const open = datasets.find((d) => /by passage number/i.test(d.title));
const gated = datasets.find((d) => /raw flow cytometry/i.test(d.title));

if (!negative || !question || !open || !gated) {
  console.error("expected the seeded posts and datasets; run the earlier seed scripts first");
  process.exit(1);
}

const { data: made } = await db.from("post_attachments").insert([
  { post_id: negative.id, kind: "dataset", dataset_id: open.id,  project_id: open.project_id,  access: "open",       owner_id: me },
  { post_id: question.id, kind: "dataset", dataset_id: gated.id, project_id: gated.project_id, access: "on_request", owner_id: me },
]).select("id, access");
console.log(`attachments: ${made.length} (one open, one on request)`);

const onRequest = made.find((a) => a.access === "on_request");
if (onRequest && okafor) {
  await db.from("access_requests").insert({
    attachment_id: onRequest.id, requester_id: okafor, owner_id: me, status: "pending",
    message: "We are about to run the same comparison and want to match your gating.",
  });
  console.log("one pending request from T. Okafor");
}
