import content from "./content.json";

/**
 * The demo store's one seeded world: a community three months into its beta
 * (26 Jul → 23 Oct 2026). Five researchers written for the demo, the people
 * from the design boards (merged in on 25 Oct 2026) and the moderation team —
 * introductions, questions, public threads, private chat, method cards,
 * projects with data and code files.
 *
 * Everything is invented: the people (every name ends in ".ex"), their
 * institutions, the materials (EUREF-1, GKi-209, FX-7, TransLipo-3…) and
 * every number in the data files. The PREVIEW banner stays on.
 *
 * The written content lives in content.json (assembled from the storyboard);
 * this file adds the structure around it and turns local times into dates.
 */

// ── time ──────────────────────────────────────────────────────────────────
/** Paris/Berlin offset for a local "YYYY-MM-DD HH:MM": summer time until the
 *  last Sunday of October, winter time until the last Sunday of March.
 *  Content is written in local wall-clock time, whatever the season. */
function offsetOf(local: string): string {
  const y = Number(local.slice(0, 4));
  const lastSunday = (month: number) => {
    const d = new Date(Date.UTC(y, month + 1, 0));          // last day of the month
    d.setUTCDate(d.getUTCDate() - d.getUTCDay());
    return d.toISOString().slice(0, 10);
  };
  const t = local.slice(0, 16);
  return t >= `${lastSunday(2)} 02:00` && t < `${lastSunday(9)} 03:00` ? "+02:00" : "+01:00";
}
const toTime = (local: string) => Date.parse(local.replace(" ", "T") + ":00" + offsetOf(local));

/**
 * The story ends at midnight after its latest activity — 23 October 2026 for
 * the first three months, later as weekly additions are made to content.json.
 */
const LATEST = Object.values(content as Record<string, { at?: string }[]>)
  .flat().map((r) => r.at).filter((x): x is string => !!x).sort().pop() ?? "2026-10-23 23:59";
const STORY_END = toTime(`${LATEST.slice(0, 10)} 00:00`) + 864e5;
const WEEK = 7 * 864e5;
/**
 * Whole weeks between the end of the story and today. Every date moves by
 * the same amount, so the latest activity always looks recent, and Saturday
 * stays Saturday — who posts at the weekend is part of the story.
 */
const SHIFT = Math.max(0, Math.floor((Date.now() - STORY_END) / WEEK) * WEEK);

/** "2026-08-30 21:10" (local time, Paris/Berlin) → ISO, shifted. */
export function at(local: string): string {
  return new Date(toTime(local) + SHIFT).toISOString();
}
/** A calendar date ("2026-12-15") moved by the same number of weeks. */
const day = (d: string | null) => (d ? at(`${d} 12:00`).slice(0, 10) : null);
const plus = (iso: string, minutes: number) => new Date(Date.parse(iso) + minutes * 6e4).toISOString();

// ── accounts ──────────────────────────────────────────────────────────────
/** Sign-ins for this set. Local demo only — the store is never used with a real database. */
export const PERSONA_ACCOUNTS: { email: string; password: string; id: string }[] = [
  { email: "lena.hofbauer@scicollab.test", password: "bouldering",  id: "u-lena" },
  { email: "mateo.ruiz@scicollab.test",    password: "goalkeeper",  id: "u-mateo" },
  { email: "ingrid.sorlie@scicollab.test", password: "birkebeiner", id: "u-ingrid" },
  { email: "priya.raman@scicollab.test",   password: "marathon",    id: "u-priya" },
  { email: "jonas.verbeke@scicollab.test", password: "cyclocross",  id: "u-jonas" },
  { email: "moderation@scicollab.test",    password: "charter",     id: "u-mod" },
  // The people from the design boards, now members of the same community.
  { email: "alex.rivera@scicollab.test",   password: "reproduce",   id: "u-rivera" },
  { email: "temi.okafor@scicollab.test",   password: "lipofection", id: "u-okafor" },
  { email: "maja.lindqvist@scicollab.test", password: "cytometer",  id: "u-lindqvist" },
  { email: "sanjana.bhatt@scicollab.test", password: "transfer",    id: "u-bhatt" },
  { email: "jamie.newcombe@scicollab.test", password: "firstcard",  id: "u-newcomer" },
  { email: "camille.laurent@scicollab.test", password: "pilot",     id: "u-laurent" },
];
/** Older sign-ins kept working, so habits and old notes still get in. */
export const ACCOUNT_ALIASES: { email: string; password: string; id: string }[] = [
  { email: "demo@scicollab.test", password: "reproduce", id: "u-rivera" },
];

const emailOf = (id: string) => PERSONA_ACCOUNTS.find((a) => a.id === id)?.email ?? "";

/** Every invented member's name ends in ".ex", so nobody mistakes them for a
 *  real person — on this demo, or anywhere the same people appear later. */
export const INVENTED_SUFFIX = ".ex";

const profile = (
  id: string, name: string, institution: string, role_title: string,
  field: string, techniques: string[], joined: string, orcid: string | null = null,
) => ({
  id, display_name: name + INVENTED_SUFFIX, institution, role_title, field, techniques,
  orcid, avatar_url: null, email: emailOf(id),
  bio: "", notifications_seen_at: null, weekly_digest: true, public_profile: false,
  created_at: at(joined),
});

/* ORCID's own public test record (a fictional researcher, Josiah Carberry,
   kept by ORCID for exactly this). It drives the citation-tracker example on
   Alex's profile and is never synced. No other member has an ORCID: a
   made-up one could belong to a real researcher. */
const ORCID_TEST_RECORD = "0000-0002-1825-0097";

/* Completeness varies on purpose: Ingrid, Mateo, Alex and Temi filled
   everything in; Jonas, Priya, Maja and Sanjana half; Lena, Camille and
   Jamie barely. All institutions are invented. */
const profiles = [
  profile("u-lena",   "Lena Hofbauer",       "Neckar Institute for Brain Research (NIBR), Heidelberg", "PhD student", "", ["iPSC differentiation"], "2026-07-26 22:10"),
  profile("u-mateo",  "Mateo Ruiz Calderón", "Öresund University Hospital, Lund", "Postdoctoral researcher · MSCA fellow", "Neuroscience · mitochondrial bioenergetics", ["Seahorse XF", "iPSC culture", "dopaminergic neurons", "live-cell imaging"], "2026-08-25 12:15"),
  profile("u-ingrid", "Ingrid Sørlie",       "Öresund University Hospital, Lund", "Professor & group leader · senior consultant neurologist", "Neuroscience · Parkinson's disease cell models", ["iPSC differentiation", "lysosomal assays", "α-synuclein", "clinical neurology"], "2026-08-03 06:40"),
  profile("u-priya",  "Priya Raman",         "Halcyon Neurotherapeutics, Leiden", "Associate Director, In Vitro Pharmacology", "", [], "2026-09-08 10:05"),
  profile("u-jonas",  "Jonas Verbeke",       "FIAM, Leuven", "Senior researcher", "Materials · solid-state batteries", ["EIS", "XRD"], "2026-08-18 20:47"),
  profile("u-mod",    "SciCollab Moderation", "SciCollab", "Community moderation", "", [], "2026-07-20 09:50"),
  profile("u-rivera", "Alex Rivera",         "Ebro Institute of Cell Biology (EICB), Zaragoza", "Postdoctoral researcher", "Cell biology", ["transfection", "flow cytometry", "qPCR"], "2026-09-01 22:00", ORCID_TEST_RECORD),
  profile("u-okafor", "Temi Okafor",         "Liffey Centre for Molecular Medicine (LCMM), Dublin", "Group leader", "Molecular biology", ["lipofection", "CRISPR", "imaging"], "2026-08-24 10:10"),
  profile("u-lindqvist", "Maja Lindqvist",   "Ebro Institute of Cell Biology (EICB), Zaragoza", "Research engineer", "", ["flow cytometry", "automation"], "2026-09-28 09:20"),
  profile("u-bhatt",  "Sanjana Bhatt",       "Ardennes Institute of Biochemistry (AIB), Liège", "PhD student", "Biochemistry", [], "2026-09-23 18:35"),
  profile("u-newcomer", "Jamie Newcombe",    "", "PhD student", "", [], "2026-10-12 10:30"),
  profile("u-laurent", "Camille Laurent",    "Institut Saône-Rhône des Sciences du Vivant (ISRSV), Lyon", "Head of research operations", "", [], "2026-10-05 10:15"),
];

/* A line in their own words, and whether signed-out visitors may see the
   profile. Only those who wrote a bio said yes. */
const BIOS: Record<string, string> = {
  "u-rivera": "Postdoc in Zaragoza. I record every transfection run, including the ones that fail, and I am happy to compare passage data with anyone.",
  "u-okafor": "Group leader in Dublin. Lipofection, CRISPR and imaging. Looking for a second lab to repeat our passage comparison.",
  "u-ingrid": "Neurologist and group leader in Lund. iPSC models of Parkinson's disease; methods that outlast the people who wrote them.",
  "u-mateo": "MSCA fellow in Lund working on mitochondrial bioenergetics in dopaminergic neurons. Seahorse questions welcome.",
};
for (const p of profiles) if (BIOS[p.id]) Object.assign(p, { bio: BIOS[p.id], public_profile: true });

// ── rooms joined ──────────────────────────────────────────────────────────
const ROOMS_JOINED: [string, string, string][] = [
  ["u-lena", "introductions", "2026-07-26 22:20"], ["u-lena", "reproducibility", "2026-07-26 22:24"],
  ["u-lena", "cell-culture", "2026-07-26 22:25"], ["u-lena", "negative-results", "2026-08-01 15:10"],
  ["u-lena", "stats-and-code", "2026-09-22 23:02"], ["u-lena", "common-room", "2026-10-05 21:40"],
  ["u-ingrid", "introductions", "2026-08-03 06:44"], ["u-ingrid", "reproducibility", "2026-08-03 06:45"],
  ["u-ingrid", "negative-results", "2026-08-03 06:45"], ["u-ingrid", "cell-culture", "2026-08-03 06:46"],
  ["u-ingrid", "grants-careers", "2026-08-04 06:30"], ["u-ingrid", "common-room", "2026-10-06 06:28"],
  ["u-jonas", "introductions", "2026-08-18 20:50"], ["u-jonas", "instruments", "2026-08-18 20:52"],
  ["u-jonas", "reproducibility", "2026-08-18 20:53"], ["u-jonas", "stats-and-code", "2026-08-18 20:53"],
  ["u-jonas", "negative-results", "2026-08-19 12:20"], ["u-jonas", "spectroscopy", "2026-08-19 12:21"],
  ["u-jonas", "common-room", "2026-10-05 20:31"],
  ["u-mateo", "introductions", "2026-08-25 12:17"], ["u-mateo", "cell-culture", "2026-08-25 12:18"],
  ["u-mateo", "negative-results", "2026-08-25 12:18"], ["u-mateo", "reproducibility", "2026-08-25 12:19"],
  ["u-mateo", "stats-and-code", "2026-08-25 12:19"], ["u-mateo", "grants-careers", "2026-09-30 20:05"],
  ["u-mateo", "common-room", "2026-10-05 20:45"],
  ["u-priya", "introductions", "2026-09-08 10:07"], ["u-priya", "reproducibility", "2026-09-08 10:08"],
  ["u-priya", "cell-culture", "2026-09-08 10:08"], ["u-priya", "instruments", "2026-09-08 10:09"],
  ["u-priya", "common-room", "2026-10-06 12:40"],
  ["u-mod", "introductions", "2026-07-20 09:55"], ["u-mod", "common-room", "2026-10-05 14:10"],
  ["u-okafor", "introductions", "2026-08-24 10:12"], ["u-okafor", "transfection", "2026-08-25 10:14"],
  ["u-okafor", "negative-results", "2026-08-25 10:15"],
  ["u-rivera", "introductions", "2026-09-01 22:05"], ["u-rivera", "western-blot", "2026-09-01 22:10"],
  ["u-rivera", "transfection", "2026-09-01 22:11"], ["u-rivera", "negative-results", "2026-09-01 22:12"],
  ["u-rivera", "stats-and-code", "2026-09-24 13:35"], ["u-rivera", "cell-culture", "2026-10-05 13:35"],
  ["u-bhatt", "introductions", "2026-09-23 18:40"], ["u-bhatt", "western-blot", "2026-09-23 18:42"],
  ["u-lindqvist", "introductions", "2026-09-28 09:22"], ["u-lindqvist", "instruments", "2026-09-28 09:25"],
  ["u-lindqvist", "grants-careers", "2026-10-16 12:05"],
  ["u-laurent", "introductions", "2026-10-05 10:16"], ["u-laurent", "grants-careers", "2026-10-05 10:30"],
  ["u-newcomer", "introductions", "2026-10-12 10:32"], ["u-newcomer", "cell-culture", "2026-10-12 10:35"],
];

// ── projects ──────────────────────────────────────────────────────────────
const projects = [
  {
    id: "pj-lena", owner_id: "u-lena", title: "Floor-plate yield variability — GSK3-inhibitor lots",
    summary: "Why TH+ yield swings between floor-plate midbrain differentiations, and the per-lot titration that fixed it. Revision experiments for the preprint live here too.",
    status: "active", tags: ["iPSC", "dopaminergic neurons", "floor plate", "small-molecule QC"], visibility: "lab",
    created_at: at("2026-08-01 15:20"), updated_at: at("2026-10-22 23:10"),
  },
  {
    id: "pj-mateo", owner_id: "u-mateo", title: "GBA1 maturation series — Seahorse analysis",
    summary: "Respiration of GBA1 N370S iPSC-derived dopaminergic neurons and their isogenic control at day 35, 60 and 100, normalised to nuclei counts. Analysis code and exports.",
    status: "active", tags: ["Seahorse XF", "GBA1", "mitochondria", "dopaminergic neurons"], visibility: "lab",
    created_at: at("2026-08-27 12:40"), updated_at: at("2026-10-21 20:30"),
  },
  {
    id: "pj-jonas", owner_id: "u-jonas", title: "FX-7 pilot batches — QC log and EIS reference set",
    summary: "Four years of pilot-line QC on a sulfide electrolyte, failed batches included, and a reference set of impedance spectra. The public part of a larger internal log.",
    status: "active", tags: ["solid-state batteries", "sulfide electrolytes", "EIS", "quality control"], visibility: "public",
    created_at: at("2026-08-20 12:45"), updated_at: at("2026-10-20 21:00"),
  },
  {
    id: "pj-ingrid", owner_id: "u-ingrid", title: "Sørlie lab — methods that must not leave with people",
    summary: "Who owns which method, where its card is, and what happens when the person who runs it moves on.",
    status: "active", tags: ["lab management", "knowledge retention"], visibility: "lab",
    created_at: at("2026-08-04 06:55"), updated_at: at("2026-10-15 07:10"),
  },
  {
    id: "p-1", owner_id: "u-rivera", title: "Transfection efficiency across passage number",
    summary: "Establishing where the cliff is, and whether it is recoverable. Feeds MC-0412.",
    status: "active", tags: ["transfection", "HEK293T"], visibility: "lab",
    created_at: at("2026-09-24 22:30"), updated_at: at("2026-10-19 18:40"),
  },
  {
    id: "p-2", owner_id: "u-rivera", title: "Incubator qualification — all three bays",
    summary: "Quarterly drift check so equipment stops being a hidden variable.",
    status: "active", tags: ["equipment"], visibility: "lab",
    created_at: at("2026-10-16 14:05"), updated_at: at("2026-10-22 11:40"),
  },
];

const project_members = [
  { project_id: "pj-lena",   user_id: "u-lena",   role: "owner",       created_at: at("2026-08-01 15:20") },
  { project_id: "pj-mateo",  user_id: "u-mateo",  role: "owner",       created_at: at("2026-08-27 12:40") },
  { project_id: "pj-mateo",  user_id: "u-ingrid", role: "contributor", created_at: at("2026-08-27 12:42") },
  { project_id: "pj-mateo",  user_id: "u-jonas",  role: "contributor", created_at: at("2026-09-24 21:05") },
  { project_id: "pj-jonas",  user_id: "u-jonas",  role: "owner",       created_at: at("2026-08-20 12:45") },
  { project_id: "pj-ingrid", user_id: "u-ingrid", role: "owner",       created_at: at("2026-08-04 06:55") },
  { project_id: "pj-ingrid", user_id: "u-mateo",  role: "contributor", created_at: at("2026-08-26 06:50") },
  { project_id: "p-1", user_id: "u-rivera",    role: "owner",       created_at: at("2026-09-24 22:30") },
  { project_id: "p-1", user_id: "u-lindqvist", role: "contributor", created_at: at("2026-09-29 13:40") },
  { project_id: "p-2", user_id: "u-rivera",    role: "owner",       created_at: at("2026-10-16 14:05") },
];

// ── attachments and access ────────────────────────────────────────────────
const post_attachments = [
  { id: "px-1", post_id: "pp-repro-lena",  kind: "dataset", dataset_id: "pd-lena-batches", code_file_id: null, project_id: "pj-lena",  access: "open",       owner_id: "u-lena",  created_at: at("2026-08-30 21:10") },
  { id: "px-2", post_id: "pp-stats-mateo", kind: "code",    dataset_id: null, code_file_id: "pf-m2",          project_id: "pj-mateo", access: "open",       owner_id: "u-mateo", created_at: at("2026-09-21 20:40") },
  { id: "px-3", post_id: "pp-stats-mateo", kind: "dataset", dataset_id: "pd-mateo-xf", code_file_id: null,    project_id: "pj-mateo", access: "on_request", owner_id: "u-mateo", created_at: at("2026-09-21 20:40") },
  { id: "pa-1", post_id: "p-1", kind: "dataset", dataset_id: "d-1", code_file_id: null, project_id: "p-1", access: "open",       owner_id: "u-rivera", created_at: at("2026-10-13 22:35") },
  { id: "pa-2", post_id: "p-2", kind: "dataset", dataset_id: "d-2", code_file_id: null, project_id: "p-1", access: "on_request", owner_id: "u-rivera", created_at: at("2026-10-22 13:40") },
];

const access_requests = [
  { id: "ar-p1", attachment_id: "px-3", requester_id: "u-priya", owner_id: "u-mateo", status: "granted",
    message: "Curious how you normalise — happy to compare with how we do it. No compound data involved on my side.",
    created_at: at("2026-09-24 10:20"), decided_at: at("2026-09-24 20:10") },
  { id: "ar-p2", attachment_id: "px-3", requester_id: "u-lena", owner_id: "u-mateo", status: "granted",
    message: "Can I look at the raw export? I want to understand where my suggestion went wrong.",
    created_at: at("2026-09-24 22:35"), decided_at: at("2026-09-25 12:05") },
  // Still open on 23 Oct: Alex has not decided yet — something to play.
  { id: "ar-1", attachment_id: "pa-2", requester_id: "u-okafor", owner_id: "u-rivera", status: "pending",
    message: "We ran the repeat with our own gating. I would like to re-gate it your way before we compare.",
    created_at: at("2026-10-23 10:05"), decided_at: null },
];

// ── the record: reproductions, reviews, recommendations, mentorships ──────
const reproductions = [
  { id: "rp-1", card_id: "pc-1203", user_id: "u-mateo", outcome: "held",
    note: "Two batches in Lund with our own inhibitor lot: titrating per lot brought the day-11 FOXA2/LMX1A fraction back into range. Day-35 TH+ still to come.",
    created_at: at("2026-10-13 12:40") },
  { id: "r-1", card_id: "c-0412", user_id: "u-okafor",    outcome: "held",   note: "Cliff between p16 and p20 in our hands too.", created_at: at("2026-10-19 11:25") },
  { id: "r-2", card_id: "c-0602", user_id: "u-lindqvist", outcome: "held",   note: "Same method on bays 1 and 2.",                   created_at: at("2026-10-23 11:45") },
  { id: "r-3", card_id: "c-0355", user_id: "u-bhatt",     outcome: "failed", note: "Got 9% serum-free at p6, so not every passage.", created_at: at("2026-10-07 18:40") },
  { id: "r-4", card_id: "c-0288", user_id: "u-rivera",    outcome: "held",   note: "41% at p10, matches.",                           created_at: at("2026-09-30 13:40") },
  { id: "r-5", card_id: "c-0517", user_id: "u-rivera",    outcome: "failed", note: "Our 150 kDa band came through at 20% MeOH.",     created_at: at("2026-10-21 22:40") },
];

const reviews = [
  { id: "rv-1", card_id: "pc-1203", reviewer_id: "u-priya", verdict: "unclear",
    body: "Which reporter cell line and passage? And is potency normalised to a fresh reference stock or to the nominal concentration? Hard to compare lots without that.",
    created_at: at("2026-09-18 10:05") },
  { id: "rv-2", card_id: "pc-1187", reviewer_id: "u-ingrid", verdict: "clear",
    body: "Ran from the card in our hands. Plating density and the FCCP range are exactly what a new person needs.",
    created_at: at("2026-08-28 06:50") },
  { id: "rv-3", card_id: "pc-1187", reviewer_id: "u-jonas", verdict: "clear",
    body: "Clear enough that a battery person could follow it. The 'check every well matched' line in v2 is the most important sentence on the card.",
    created_at: at("2026-09-25 12:50") },
  { id: "rv-4", card_id: "pc-1195", reviewer_id: "u-mateo", verdict: "unclear",
    body: "As a biologist I needed the cell constant explained — how do you go from ohms to mS/cm? One line would help people like me.",
    created_at: at("2026-10-02 12:30") },
  { id: "v-1", card_id: "c-0517", reviewer_id: "u-rivera", verdict: "unclear", body: "Which membrane? PVDF and nitrocellulose behave differently here.", created_at: at("2026-10-21 13:50") },
  { id: "v-2", card_id: "c-0288", reviewer_id: "u-rivera", verdict: "clear",   body: "Ran from the card alone without questions.",                       created_at: at("2026-10-01 13:45") },
  { id: "v-3", card_id: "c-0412", reviewer_id: "u-okafor", verdict: "clear",   body: "Reproducible from the card as written.",                           created_at: at("2026-10-20 10:05") },
];

const recommendations = [
  ["pc-1203", "u-ingrid", "2026-08-31 06:52"], ["pc-1188", "u-ingrid", "2026-09-04 06:36"],
  ["pc-1203", "u-mateo", "2026-08-31 12:31"],  ["pc-1195", "u-mateo", "2026-10-02 12:31"],
  ["pc-1203", "u-priya", "2026-09-26 10:30"],  ["pc-1187", "u-priya", "2026-09-24 10:21"],
  ["pc-1187", "u-jonas", "2026-09-25 12:51"],  ["pc-1204", "u-jonas", "2026-09-01 20:31"],
  ["pc-1188", "u-lena", "2026-09-04 23:31"],   ["pc-1196", "u-lena", "2026-08-22 16:25"],
  ["c-0412", "u-okafor", "2026-10-19 11:26"],  ["c-0412", "u-lindqvist", "2026-10-15 09:30"],
  ["c-0412", "u-bhatt", "2026-10-14 18:50"],   ["c-0355", "u-okafor", "2026-09-14 10:30"],
  ["c-0602", "u-lindqvist", "2026-10-23 11:46"], ["c-0602", "u-newcomer", "2026-10-20 11:00"],
  ["c-0391", "u-lindqvist", "2026-10-05 10:10"], ["c-0288", "u-rivera", "2026-09-30 13:41"],
  // across the two groups: negative results find each other
  ["pc-1188", "u-okafor", "2026-09-07 10:15"],  ["c-0412", "u-mateo", "2026-10-14 12:20"],
].map(([card_id, user_id, t]) => ({ card_id, user_id, created_at: at(t) }));

const mentorships = [
  { id: "g-p1", mentor_id: "u-ingrid", mentee_id: "u-lena",
    note: "Read my response to reviewers before I sent it — three comments that changed it.", created_at: at("2026-10-21 22:50") },
  { id: "g-p2", mentor_id: "u-jonas", mentee_id: "u-mateo",
    note: "Found the bug in my merge and explained it so I will not do it again.", created_at: at("2026-09-24 21:10") },
  { id: "g-1", mentor_id: "u-rivera", mentee_id: "u-newcomer", note: "Walked me through recording my first card.", created_at: at("2026-10-21 16:20") },
  { id: "g-2", mentor_id: "u-rivera", mentee_id: "u-bhatt",    note: "Transfer conditions for high-MW blots.",     created_at: at("2026-10-22 21:30") },
];

/* Reads of the public cards, week by week — a 50-person beta, so modest.
   Deterministic, so the numbers do not jump between reloads. */
function cardReads(cards: { id: string; visibility: string; created_at: string }[]) {
  const places = [
    "Neckar Institute for Brain Research (NIBR), Heidelberg", "Öresund University Hospital, Lund",
    "Halcyon Neurotherapeutics, Leiden", "FIAM, Leuven", "Ebro Institute of Cell Biology (EICB), Zaragoza",
    "Liffey Centre for Molecular Medicine (LCMM), Dublin", "Ardennes Institute of Biochemistry (AIB), Liège", "",
  ];
  const vias = ["search", "a question", "another card", "home feed", "a message", "direct"];
  const monday = (d: Date) => {
    const x = new Date(d); const k = (x.getUTCDay() + 6) % 7;
    x.setUTCDate(x.getUTCDate() - k); return x.toISOString().slice(0, 10);
  };
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const out: Record<string, unknown>[] = [];
  const now = STORY_END + SHIFT;
  for (const c of cards.filter((x) => x.visibility === "public")) {
    const born = Date.parse(c.created_at);
    for (let t = born; t <= now; t += WEEK) {
      const n = Math.round(1 + rnd() * 4 + (c.id === "pc-1203" ? 2 : 0));
      for (let r = 0; r < n; r++) {
        out.push({
          card_id: c.id, week: monday(new Date(t)),
          institution: places[Math.floor(rnd() * places.length)],
          via: vias[Math.floor(rnd() * rnd() * vias.length)],
          reader_key: `p-${c.id}-${t}-${r}`,
        });
      }
    }
  }
  return out;
}

// ── the social layer (supabase/08-social.sql) ────────────────────────────
/* Who follows whom. Mostly people who already work together or answered
   each other; nobody follows everyone. */
const follows = [
  ["u-rivera", "u-okafor", "2026-09-03 10:00"], ["u-rivera", "u-lindqvist", "2026-09-29 09:00"],
  ["u-rivera", "u-mateo", "2026-10-15 12:00"],  ["u-okafor", "u-rivera", "2026-09-04 11:20"],
  ["u-lindqvist", "u-rivera", "2026-09-28 10:00"], ["u-bhatt", "u-rivera", "2026-10-15 19:00"],
  ["u-newcomer", "u-rivera", "2026-10-13 09:30"], ["u-mateo", "u-ingrid", "2026-08-26 08:00"],
  ["u-lena", "u-ingrid", "2026-07-27 21:00"],    ["u-ingrid", "u-mateo", "2026-08-27 07:10"],
  ["u-mateo", "u-jonas", "2026-09-20 21:00"],    ["u-priya", "u-ingrid", "2026-09-09 10:00"],
].map(([follower_id, followee_id, t]) => ({ follower_id, followee_id, created_at: at(t) }));

const groups = [
  { id: "gr-ebro", name: "Rivera–Lindqvist bench, EICB", access: "closed", created_by: "u-rivera", created: "2026-09-29 10:00",
    institution: "Ebro Institute of Cell Biology (EICB), Zaragoza", description: "Transfection, flow cytometry and the incubator log. Two people, one bench, every run recorded." },
  { id: "gr-lund", name: "Sørlie group, Lund", access: "closed", created_by: "u-ingrid", created: "2026-08-04 08:00",
    institution: "Öresund University Hospital, Lund", description: "Parkinson's disease cell models: iPSC-derived dopaminergic neurons, lysosomes, mitochondria." },
  { id: "gr-transfection", name: "Transfection journal club", access: "open", created_by: "u-okafor", created: "2026-09-10 09:00",
    institution: "", description: "One paper or one failed run every second Thursday. Anyone who transfects anything is welcome." },
].map(({ created, ...g }) => ({ ...g, created_at: at(created) }));

const group_members = [
  ["gr-ebro", "u-rivera", "owner", "2026-09-29 10:00"], ["gr-ebro", "u-lindqvist", "member", "2026-09-29 10:05"],
  ["gr-lund", "u-ingrid", "owner", "2026-08-04 08:00"], ["gr-lund", "u-mateo", "admin", "2026-08-26 08:30"],
  ["gr-lund", "u-lena", "alumni", "2026-08-05 09:00"], ["gr-ebro", "u-okafor", "guest", "2026-10-02 10:00"],
  ["gr-transfection", "u-okafor", "owner", "2026-09-10 09:00"], ["gr-transfection", "u-rivera", "member", "2026-09-11 10:00"],
  ["gr-transfection", "u-bhatt", "member", "2026-09-24 18:00"], ["gr-transfection", "u-lindqvist", "member", "2026-10-01 09:00"],
].map(([group_id, user_id, role, t]) => ({ group_id, user_id, role, joined_at: at(t) }));

const group_projects = [
  ["gr-ebro", "p-1", "u-rivera", "2026-09-29 10:10"], ["gr-ebro", "p-2", "u-rivera", "2026-09-29 10:10"],
  ["gr-lund", "pj-mateo", "u-mateo", "2026-08-28 09:00"], ["gr-lund", "pj-ingrid", "u-ingrid", "2026-08-05 07:00"],
].map(([group_id, project_id, added_by, t]) => ({ group_id, project_id, added_by, added_at: at(t) }));

/* Lab discussions: posts visible only inside a group (supabase/11). */
const group_posts = [
  { id: "gp-ebro-1", group_id: "gr-ebro", author_id: "u-lindqvist", intent: "update", title: "Bay 3 sensor recalibrated, logger back on",
    body: "Service came this morning. Bay 3 now reads within 0.1% of the reference meter. @Alex Rivera.ex the passage series can restart on Monday.", at: "2026-10-21 09:40" },
  { id: "gp-ebro-2", group_id: "gr-ebro", author_id: "u-rivera", intent: "general", title: "Who has the last aliquot of TransLipo-3 lot 22?",
    body: "I need two tubes for the p18 repeat. If it is in your box, please put it in the shared rack.", at: "2026-10-22 14:05" },
  { id: "gp-lund-1", group_id: "gr-lund", author_id: "u-ingrid", intent: "update", title: "Lab meeting moved to Thursday 9:00",
    body: "Mateo presents the GBA1 maturation series. Please read the notebook entries from last week before.", at: "2026-10-20 07:30" },
  { id: "gp-tc-1", group_id: "gr-transfection", author_id: "u-okafor", intent: "general", title: "Next session: passage effects, bring one failed run",
    body: "Two weeks from now. Everyone brings one run that did not work and the card that goes with it.", at: "2026-10-19 10:10" },
];

const reactions = [
  ["u-okafor", "post", "p-1", "seen", "2026-09-20 11:00"], ["u-lindqvist", "post", "p-1", "useful", "2026-09-29 09:10"],
  ["u-mateo", "post", "p-1", "seen", "2026-10-14 12:25"],  ["u-okafor", "post", "p-2", "can_help", "2026-10-17 10:00"],
  ["u-lindqvist", "post", "p-2", "useful", "2026-10-17 15:00"], ["u-rivera", "post", "p-4", "can_help", "2026-10-18 09:00"],
  ["u-rivera", "post", "p-3", "useful", "2026-10-15 20:00"],  ["u-ingrid", "post", "pp-stats-mateo", "useful", "2026-10-10 07:00"],
  ["u-rivera", "answer", "a-1", "useful", "2026-09-22 10:00"], ["u-bhatt", "answer", "a-r1", "useful", "2026-10-15 19:10"],
  ["u-mateo", "answer", "a-1", "seen", "2026-10-14 12:30"],   ["u-okafor", "answer", "a-r3", "useful", "2026-10-19 11:30"],
].map(([user_id, target_kind, target_id, kind, t], i) => ({ id: `rx-${i}`, user_id, target_kind, target_id, kind, created_at: at(t) }));

// ── the written content ───────────────────────────────────────────────────
type Row = Record<string, any>;
const C = content as unknown as Record<string, Row[]>;
const list = (k: string) => (C[k] ?? []) as Row[];

function build() {
  const posts = list("posts").map((p) => ({
    id: p.id, author_id: p.author_id, room_id: p.room_id, intent: p.intent, title: p.title, body: p.body,
    method_card_id: p.method_card_id ?? null, project_id: p.project_id ?? null,
    technique: p.technique ?? "", organism: p.organism ?? "", deadline: day(p.deadline ?? null), offer: p.offer ?? "",
    created_at: at(p.at),
  }));
  for (const g of group_posts) posts.push({
    id: g.id, author_id: g.author_id, room_id: "", group_id: g.group_id, intent: g.intent, title: g.title, body: g.body,
    method_card_id: null, project_id: null, technique: "", organism: "", deadline: null, offer: "", created_at: at(g.at),
  } as any);
  const post_replies = list("replies").map((r) => ({ id: r.id, post_id: r.post_id, author_id: r.author_id, body: r.body, created_at: at(r.at) }));
  const questions = list("questions").map((q, i) => ({
    id: q.id, author_id: q.author_id, title: q.title, body: q.body, tags: q.tags ?? [],
    method_card_id: q.method_card_id ?? null, visibility: "public", views: q.views ?? 12 + i * 5, created_at: at(q.at),
  }));
  const answers = list("answers").map((a, i) => ({
    id: a.id, question_id: a.question_id, author_id: a.author_id, body: a.body,
    accepted: !!a.accepted, votes: a.votes ?? (a.accepted ? 6 : (i % 3) + 1), created_at: at(a.at),
  }));
  const messages = list("messages").map((m) => ({
    id: m.id, sender_id: m.sender_id, recipient_id: m.recipient_id, body: m.body,
    method_card_id: m.method_card_id ?? null, read_at: m.read === false ? null : plus(at(m.at), 30),
    created_at: at(m.at),
  }));
  const method_cards = list("cards").map((c) => ({
    id: c.id, code: c.code, version: c.version, author_id: c.author_id, title: c.title,
    method: c.method ?? "", system: c.system ?? "", conditions: c.conditions ?? "",
    outcome: c.outcome === "null" ? null : (c.outcome ?? null), outcome_detail: c.outcome_detail ?? "",
    fails_under: c.fails_under ?? "", tags: c.tags ?? [], visibility: c.visibility,
    forked_from: c.forked_from ?? null,
    reproductions: reproductions.filter((r) => r.card_id === c.id).length,
    created_at: at(c.at), updated_at: at(c.updated_at ?? c.at),
  }));
  const eln_entries = list("entries").map((e) => ({ id: e.id, project_id: e.project_id, author_id: e.author_id, body: e.body, signed_at: at(e.at), created_at: at(e.at) }));
  const datasets = list("datasets").map((d) => ({
    id: d.id, owner_id: d.owner_id, project_id: d.project_id, title: d.title, summary: d.summary ?? "",
    doi: d.doi ?? null, licence: d.licence ?? "CC BY 4.0", visibility: d.visibility, size_bytes: d.size_bytes ?? 0,
    file_path: d.file ?? null, created_at: at(d.at),
  }));
  const code_files = list("code_files").map((f) => ({
    id: f.id, project_id: f.project_id, path: f.path, language: f.language ?? "", size_bytes: f.size_bytes ?? 0,
    last_change: f.last_change ?? "", file_path: f.file ?? null, created_at: at(f.at), updated_at: at(f.updated_at ?? f.at),
  }));
  const code_commits = list("commits").map((k) => ({ id: k.id, project_id: k.project_id, author_id: k.author_id, sha: k.sha, message: k.message, files: k.files ?? 1, created_at: at(k.at) }));

  /* Keep the world consistent with whatever content is present: a project
     with nothing in it is not shown, and no row may point at a card, post,
     dataset or project that is not there. */
  const has = (rows: Row[]) => new Set(rows.map((r) => r.id));
  const cardIds = has(method_cards), postIds = has(posts), dataIds = has(datasets), codeIds = has(code_files);
  const used = new Set([...eln_entries, ...datasets, ...code_files, ...code_commits].map((r) => r.project_id));
  const liveProjects = projects.filter((p) => used.has(p.id));
  const projectIds = has(liveProjects);
  const cardOrNull = (id: string | null) => (id && cardIds.has(id) ? id : null);
  for (const r of [...posts, ...messages, ...questions]) r.method_card_id = cardOrNull(r.method_card_id);
  for (const p of posts) if (p.project_id && !projectIds.has(p.project_id)) p.project_id = null;
  for (const c of method_cards) if (c.forked_from && !cardIds.has(c.forked_from)) c.forked_from = null;
  const attachments = post_attachments.filter((a) =>
    postIds.has(a.post_id) && projectIds.has(a.project_id) &&
    (a.dataset_id ? dataIds.has(a.dataset_id) : a.code_file_id ? codeIds.has(a.code_file_id) : false));
  const attachmentIds = has(attachments);
  const onCard = <T extends { card_id: string }>(rows: T[]) => rows.filter((r) => cardIds.has(r.card_id));

  return {
    profiles,
    method_cards,
    questions,
    answers,
    projects: liveProjects,
    project_members: project_members.filter((m) => projectIds.has(m.project_id)),
    eln_entries,
    messages,
    user_rooms: ROOMS_JOINED.map(([user_id, room_id, t]) => ({ user_id, room_id, joined_at: at(t) })),
    posts,
    post_replies,
    datasets,
    code_files,
    code_commits,
    post_attachments: attachments,
    access_requests: access_requests.filter((r) => attachmentIds.has(r.attachment_id)),
    reproductions: onCard(reproductions),
    reviews: onCard(reviews),
    recommendations: onCard(recommendations),
    mentorships,
    card_reads: cardReads(method_cards),
    follows, groups, group_members,
    group_projects: group_projects.filter((g) => projectIds.has(g.project_id)),
    reactions: reactions.filter((r) => (r.target_kind === "post" ? postIds : has(answers)).has(r.target_id)),
    mentions: [],
    group_requests: [], group_invites: [],
    moderators: [{ user_id: "u-mod", added_at: at("2026-07-20 09:50") }],
    reports: [
      { id: "rp-1", reporter_id: "u-bhatt", target_kind: "post", target_id: "pp-common-jonas", reason: "spam", note: "Off-topic in a technical room?", status: "open", created_at: at("2026-10-22 18:00"), resolved_by: null, resolved_at: null, resolution: "" },
      { id: "rp-2", reporter_id: "u-newcomer", target_kind: "profile", target_id: "u-priya", reason: "other", note: "Is this a vendor account? Just checking.", status: "open", created_at: at("2026-10-23 08:15"), resolved_by: null, resolved_at: null, resolution: "" },
    ],
    citation_snapshots: [], openalex_authors: [], publications: [], sync_runs: [],
  } as unknown as Record<string, Record<string, unknown>[]>;
}

export function personaTables(): Record<string, Record<string, unknown>[]> {
  return build();
}
