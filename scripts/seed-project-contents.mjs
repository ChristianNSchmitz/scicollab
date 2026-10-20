/** Datasets and code for the seeded projects, so the three project tabs have
 *  something to show on the real database. Idempotent. */
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
const me = list.users.find((u) => u.email === "demo@scicollab.test")?.id;
const lind = list.users.find((u) => u.email === "lindqvist@scicollab.test")?.id;
if (!me) { console.error("run scripts/seed-demo.mjs first"); process.exit(1); }

const { data: projects } = await db.from("projects").select("id, title").order("created_at");
const passage = projects.find((p) => /passage/i.test(p.title));
const incubator = projects.find((p) => /incubator/i.test(p.title));
if (!passage) { console.error("expected the passage-number project; run scripts/seed-rooms.mjs first"); process.exit(1); }

const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();

const { count: haveFiles } = await db.from("code_files").select("id", { count: "exact", head: true });
if (haveFiles > 0) { console.log(`code already seeded (${haveFiles} files) — nothing to do`); process.exit(0); }

await db.from("datasets").insert([
  { owner_id: me, project_id: passage.id, title: "Transfection efficiency by passage number (p8–p24)",
    summary: "Flow cytometry readings, three biological replicates per passage, two reagent lots. The source for MC-0412.",
    doi: "10.5281/zenodo.8841", licence: "CC BY 4.0", visibility: "public", size_bytes: 48200000, created_at: ago(10) },
  { owner_id: me, project_id: passage.id, title: "Raw flow cytometry · run 14–16",
    summary: "Unprocessed .fcs files behind the p19 replicates. Gating strategy is in the notebook entry of the same date.",
    licence: "CC BY 4.0", visibility: "lab", size_bytes: 1240000000, created_at: ago(9) },
  { owner_id: me, project_id: passage.id, title: "Reagent lot comparison — L3K-2251 vs L3K-1980",
    summary: "The control that ruled reagent out as the variable.",
    licence: "CC BY 4.0", visibility: "lab", size_bytes: 3100000, created_at: ago(7) },
  ...(incubator ? [{ owner_id: me, project_id: incubator.id, title: "CO₂ logging · all three bays · 72 h",
    summary: "Independent meter against each incubator's own readout, logged hourly.",
    licence: "CC0 1.0", visibility: "lab", size_bytes: 820000, created_at: ago(2) }] : []),
]);
console.log("datasets seeded");

await db.from("code_files").insert([
  { project_id: passage.id, path: "README.md", language: "Markdown", size_bytes: 2400, last_change: "Document the gating strategy", updated_at: ago(7) },
  { project_id: passage.id, path: "analysis/gating.py", language: "Python", size_bytes: 11800, last_change: "Exclude doublets before the live gate", updated_at: ago(7) },
  { project_id: passage.id, path: "analysis/passage_curve.py", language: "Python", size_bytes: 8300, last_change: "Fit a sigmoid rather than a line", updated_at: ago(5) },
  { project_id: passage.id, path: "analysis/figures.R", language: "R", size_bytes: 5100, last_change: "Error bars are SD across biological replicates", updated_at: ago(5) },
  { project_id: passage.id, path: "notebooks/exploration.ipynb", language: "Jupyter", size_bytes: 412000, last_change: "First pass over the p19 data", updated_at: ago(9) },
  { project_id: passage.id, path: "environment.yml", language: "YAML", size_bytes: 940, last_change: "Pin scipy — the fit changed between versions", updated_at: ago(5) },
  ...(incubator ? [
    { project_id: incubator.id, path: "logger/read_meter.py", language: "Python", size_bytes: 3600, last_change: "Poll every hour instead of every minute", updated_at: ago(2) },
    { project_id: incubator.id, path: "logger/plot_drift.R", language: "R", size_bytes: 2200, last_change: "Plot all three bays on one axis", updated_at: ago(2) },
  ] : []),
]);
console.log("code files seeded");

await db.from("code_commits").insert([
  { project_id: passage.id, author_id: me, sha: "a3f91c4e2b", files: 2, message: "Fit a sigmoid rather than a line — the drop is not gradual", created_at: ago(5) },
  { project_id: passage.id, author_id: lind ?? me, sha: "7d2e88b104", files: 1, message: "Error bars are SD across biological replicates", created_at: ago(5) },
  { project_id: passage.id, author_id: me, sha: "0b55e1d9a8", files: 1, message: "Pin scipy — the fit changed between versions", created_at: ago(5) },
  { project_id: passage.id, author_id: me, sha: "c914aa7f30", files: 3, message: "Exclude doublets before the live gate", created_at: ago(7) },
  ...(incubator ? [{ project_id: incubator.id, author_id: me, sha: "e81c30fa55", files: 2, message: "Poll every hour instead of every minute", created_at: ago(2) }] : []),
]);
console.log("commits seeded");
