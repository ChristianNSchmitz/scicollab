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
 * Content follows the boards: Alex Rivera is the researcher persona, and the
 * seed cards are the ones the boards themselves use as examples.
 */

export type Outcome = "success" | "partial" | "negative" | null;
export type Visibility = "private" | "lab" | "public";

export type Profile = {
  id: string; display_name: string; institution: string; role_title: string;
  field: string; orcid: string | null; techniques: string[];
};

export type Card = {
  id: string; code: string; version: number; author_id: string; title: string;
  method: string; system: string; conditions: string; outcome: Outcome;
  outcome_detail: string; fails_under: string; tags: string[];
  visibility: Visibility; forked_from: string | null; reproductions: number;
  created_at: string;
};

export type Question = {
  id: string; author_id: string; title: string; body: string; tags: string[];
  method_card_id: string | null; created_at: string;
};

export type Answer = {
  id: string; question_id: string; author_id: string; body: string;
  accepted: boolean; created_at: string;
};

export type Project = {
  id: string; owner_id: string; title: string; summary: string; status: string;
  tags: string[]; visibility: Visibility; created_at: string;
};

export type Entry = {
  id: string; project_id: string; author_id: string; body: string; created_at: string;
};

export type Message = {
  id: string; sender_id: string; recipient_id: string; body: string;
  method_card_id: string | null; read_at: string | null; created_at: string;
};

export const DEMO_EMAIL = "demo@scicollab.test";
export const DEMO_PASSWORD = "reproduce";

const ago = (days: number, hours = 0) =>
  new Date(Date.now() - days * 864e5 - hours * 36e5).toISOString();

export const ME = "u-rivera";

const profiles: Profile[] = [
  { id: ME, display_name: "Alex Rivera (example)", institution: "Example Lab · demo data", role_title: "Postdoctoral researcher", field: "Cell biology", orcid: "0000-0002-1825-0097", techniques: ["transfection", "flow cytometry", "qPCR"] },
  { id: "u-okafor", display_name: "T. Okafor (example)", institution: "Example Institute · demo data", role_title: "Group leader", field: "Molecular biology", orcid: "0000-0001-5109-3700", techniques: ["lipofection", "CRISPR", "imaging"] },
  { id: "u-lindqvist", display_name: "M. Lindqvist (example)", institution: "Example Lab · demo data", role_title: "Research engineer", field: "Cell biology", orcid: null, techniques: ["flow cytometry", "automation"] },
  { id: "u-bhatt", display_name: "S. Bhatt (example)", institution: "Example University · demo data", role_title: "PhD student", field: "Biochemistry", orcid: null, techniques: ["western blot", "transfection"] },
  { id: "u-newcomer", display_name: "J. Newcomer (example)", institution: "Unaffiliated · demo data", role_title: "PhD student", field: "Cell biology", orcid: null, techniques: [] },
  { id: "u-laurent", display_name: "Dr Camille Laurent (example)", institution: "Example Agency · demo data", role_title: "Head of research operations", field: "Research governance", orcid: null, techniques: [] },
];

const cards: Card[] = [
  {
    id: "c-0288", code: "MC-0288", version: 6, author_id: "u-okafor",
    title: "Lipofection of HEK293T at low passage",
    method: "Lipofectamine 3000, 2.5 µg donor plasmid in 25 µL Opti-MEM. Serum-free at the dilution step only — carrying serum-free through incubation is the most common way to break this.",
    system: "H. sapiens · HEK293T (CVCL_0063)", conditions: "37 °C · 5% CO₂ · 48 h",
    outcome: "success", outcome_detail: "41 ± 3% at p < 12, across eight recorded runs.",
    fails_under: "Passage above 18 — efficiency falls to 4 ± 1%, and it is not recoverable by changing reagent lot. Serum-free medium carried through incubation drops it below 5%. CO₂ drift below 4.5% mimics the passage effect.",
    tags: ["transfection", "lipofection", "HEK293T"], visibility: "public",
    forked_from: null, reproductions: 8, created_at: ago(39),
  },
  {
    id: "c-0412", code: "MC-0412", version: 4, author_id: ME,
    title: "Lipofection at high passage — efficiency collapse",
    method: "As MC-0288, run deliberately at p19–p24 to characterise the failure rather than avoid it.",
    system: "HEK293T · p19–p24", conditions: "37 °C · 5% CO₂ · 48 h",
    outcome: "negative", outcome_detail: "38% ± 6 at p12 falling to 4 ± 1% by p19. Below target in every replicate.",
    fails_under: "Passage above 18, or serum-free medium at transfection. Both tried, both below 5%. Recorded so nobody in this lab loses another week to it.",
    tags: ["transfection", "HEK293T", "passage number"], visibility: "public",
    forked_from: "c-0288", reproductions: 2, created_at: ago(11),
  },
  {
    id: "c-0517", code: "MC-0517", version: 1, author_id: "u-bhatt",
    title: "Anti-GFP western blot — signal loss above 100 kDa",
    method: "Wet transfer, 100 V for 60 min, 20% methanol in the transfer buffer.",
    system: "HEK293T lysate", conditions: "pH 8.3 · 20% MeOH · 60 min 100 V",
    outcome: "partial", outcome_detail: "Bands below 100 kDa are clean. Everything above is faint or absent.",
    fails_under: "20% methanol at high molecular weight. Untested below 10%.",
    tags: ["western blot", "transfer"], visibility: "public",
    forked_from: null, reproductions: 0, created_at: ago(4),
  },
  {
    id: "c-0602", code: "MC-0602", version: 2, author_id: ME,
    title: "CO₂ incubator drift check before blaming the cells",
    method: "Independent CO₂ meter logged hourly for 72 h against the incubator's own readout.",
    system: "Incubator · bay 3", conditions: "target 5% CO₂",
    outcome: "success", outcome_detail: "Incubator under-reads by 0.6% consistently. Logged before every transfection now.",
    fails_under: "Only valid for bay 3. The two other incubators drift the other way.",
    tags: ["equipment", "quality control"], visibility: "lab",
    forked_from: null, reproductions: 1, created_at: ago(2),
  },
  {
    id: "c-0733", code: "MC-0733", version: 1, author_id: ME,
    title: "Plasmid prep endotoxin threshold — unfinished",
    method: "Comparing two prep kits at matched yield.",
    system: "E. coli DH5α", conditions: "—",
    outcome: null, outcome_detail: "", fails_under: "",
    tags: ["plasmid prep"], visibility: "private",
    forked_from: null, reproductions: 0, created_at: ago(1),
  },
];

const questions: Question[] = [
  {
    id: "q-2291", author_id: ME,
    title: "Transfection efficiency collapses above passage 18 — is this receptor loss or something I am doing?",
    body: "Three biological replicates, two reagent lots, fresh medium each time. MC-0288 holds perfectly below p12 and falls apart above p18. Reagent lot is not the variable — S. Bhatt ran L3K-2251 at p10 and got normal numbers.\n\nIs this a known receptor-density effect, or am I missing a step?",
    tags: ["transfection", "HEK293T", "passage number"], method_card_id: "c-0412",
    created_at: ago(10),
  },
  {
    id: "q-2304", author_id: "u-bhatt",
    title: "High-MW transfer: how far down can methanol go before the low-MW bands suffer?",
    body: "Following MC-0517. Dropping to 10% methanol is the standard advice but I cannot find anyone who recorded what it costs below 50 kDa.",
    tags: ["western blot", "transfer"], method_card_id: "c-0517",
    created_at: ago(3),
  },
];

const answers: Answer[] = [
  {
    id: "a-1", question_id: "q-2291", author_id: "u-okafor",
    body: "Receptor loss, and it is cooperative — which is why it looks like a cliff rather than a slope. We characterised it on MC-0288 and it is not recoverable by reagent change.\n\nTwo things worth logging before you conclude anything: CO₂ drift below 4.5% produces almost exactly the same curve, and so does carrying serum-free medium through incubation. Rule both out first.",
    accepted: true, created_at: ago(9),
  },
  {
    id: "a-2", question_id: "q-2291", author_id: "u-lindqvist",
    body: "Adding the CO₂ drift case to the card cost us two months of misattribution, so I would check the incubator before the cells. Your MC-0602 is exactly the right shape for that.",
    accepted: false, created_at: ago(8),
  },
];

const projects: Project[] = [
  {
    id: "p-1", owner_id: ME, title: "Transfection efficiency across passage number",
    summary: "Establishing where the cliff is, and whether it is recoverable. Feeds MC-0412.",
    status: "active", tags: ["transfection", "HEK293T"], visibility: "lab", created_at: ago(30),
  },
  {
    id: "p-2", owner_id: ME, title: "Incubator qualification — all three bays",
    summary: "Quarterly drift check so equipment stops being a hidden variable.",
    status: "active", tags: ["equipment"], visibility: "lab", created_at: ago(6),
  },
];

const members = [
  { project_id: "p-1", user_id: ME, role: "owner" },
  { project_id: "p-1", user_id: "u-lindqvist", role: "contributor" },
  { project_id: "p-2", user_id: ME, role: "owner" },
];

const entries: Entry[] = [
  { id: "e-1", project_id: "p-1", author_id: ME, body: "p19 run, triplicate. 4.2%, 3.8%, 4.4%. Matches p21 from last week — the cliff is real and it is not gradual.", created_at: ago(9) },
  { id: "e-2", project_id: "p-1", author_id: ME, body: "Swapped to lot L3K-2251 at p19 to rule out reagent. 4.1%. Reagent is not the variable.", created_at: ago(7) },
  { id: "e-3", project_id: "p-2", author_id: ME, body: "Bay 3 under-reads by 0.6% against the independent meter, stable across 72 h. Bays 1 and 2 drift the other way.", created_at: ago(2) },
];

const messages: Message[] = [
  { id: "m-1", sender_id: "u-okafor", recipient_id: ME, body: "Saw your null result on MC-0412. We are about to run the same passage comparison — can I see the raw gating before we start?", method_card_id: null, read_at: ago(9), created_at: ago(9, 2) },
  { id: "m-2", sender_id: ME, recipient_id: "u-okafor", body: "Yes — here is the card. It is Lab visibility, so this grants you read access as an individual, not to your whole group.", method_card_id: "c-0412", read_at: ago(9), created_at: ago(9, 1) },
  { id: "m-3", sender_id: "u-okafor", recipient_id: ME, body: "Perfect. I will record our run against it either way, including if it disagrees with yours.", method_card_id: null, read_at: null, created_at: ago(8) },
];


/* Seeded sign-ins. The password is shared and deliberately guessable: this
   store has no real data in it and exists so the app runs without a backend. */
const DEMO_PASSWORD_VALUE = DEMO_PASSWORD;
const credentials = new Map<string, string>([
  ["demo@scicollab.test", DEMO_PASSWORD_VALUE],
  ["okafor@scicollab.test", DEMO_PASSWORD_VALUE],
  ["lindqvist@scicollab.test", DEMO_PASSWORD_VALUE],
  ["bhatt@scicollab.test", DEMO_PASSWORD_VALUE],
  ["newcomer@scicollab.test", DEMO_PASSWORD_VALUE],
]);
const emailToId = new Map<string, string>([
  ["demo@scicollab.test", ME],
  ["okafor@scicollab.test", "u-okafor"],
  ["lindqvist@scicollab.test", "u-lindqvist"],
  ["bhatt@scicollab.test", "u-bhatt"],
  ["newcomer@scicollab.test", "u-newcomer"],
]);


/* ── raw table access ─────────────────────────────────────────────────────
   The demo client shim queries these by name, exactly as PostgREST would.
   They are live references: writes through the shim mutate them in place. */
export const tables: Record<string, Record<string, unknown>[]> = {
  profiles,
  method_cards: cards,
  questions,
  answers,
  projects,
  project_members: members,
  eln_entries: entries,
  messages,
  datasets: [],
} as unknown as Record<string, Record<string, unknown>[]>;

/** Everyone seeded shares one password; a demo account is not a secret. */
export function authenticate(email: string, password: string): string | null {
  const known = credentials.get(email.trim().toLowerCase());
  return known && known === password ? emailToId.get(email.trim().toLowerCase())! : null;
}

/** Sign-up in demo mode: a real profile, held in memory until restart. */
export function register(email: string, password: string, display_name: string, institution: string): string {
  const addr = email.trim().toLowerCase();
  const id = `u-${Math.random().toString(36).slice(2, 9)}`;
  profiles.push({
    id, display_name: display_name || addr.split("@")[0], institution,
    role_title: "", field: "", orcid: null, techniques: [],
  });
  credentials.set(addr, password);
  emailToId.set(addr, id);
  return id;
}

export function emailTaken(email: string): boolean {
  return credentials.has(email.trim().toLowerCase());
}

// ── accessors ────────────────────────────────────────────────────────────
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
const newId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`;

export const demo = {
  me: () => clone(profiles.find((p) => p.id === ME)!),
  profile: (id: string) => clone(profiles.find((p) => p.id === id) ?? null),
  profiles: () => clone(profiles),

  cards: () => clone([...cards].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))),
  card: (id: string) => clone(cards.find((c) => c.id === id) ?? null),
  forksOf: (id: string) => clone(cards.filter((c) => c.forked_from === id)),

  questions: () => clone([...questions].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))),
  question: (id: string) => clone(questions.find((q) => q.id === id) ?? null),
  answers: (qid: string) =>
    clone(answers.filter((a) => a.question_id === qid)
      .sort((a, b) => Number(b.accepted) - Number(a.accepted) || +new Date(a.created_at) - +new Date(b.created_at))),

  projects: () => clone([...projects].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))),
  project: (id: string) => clone(projects.find((p) => p.id === id) ?? null),
  members: (pid: string) => clone(members.filter((m) => m.project_id === pid)),
  entries: (pid: string) =>
    clone(entries.filter((e) => e.project_id === pid).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))),

  messages: () => clone(messages),
  thread: (otherId: string) =>
    clone(messages
      .filter((m) => (m.sender_id === ME && m.recipient_id === otherId) || (m.sender_id === otherId && m.recipient_id === ME))
      .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))),

  // ── writes ─────────────────────────────────────────────────────────────
  addCard(input: Partial<Card>): Card {
    const n = cards.length + 288;
    const card: Card = {
      id: newId("c"), code: `MC-0${n}`, version: 1, author_id: ME,
      title: input.title ?? "Untitled", method: input.method ?? "", system: input.system ?? "",
      conditions: input.conditions ?? "", outcome: (input.outcome ?? null) as Outcome,
      outcome_detail: input.outcome_detail ?? "", fails_under: input.fails_under ?? "",
      tags: input.tags ?? [], visibility: (input.visibility ?? "private") as Visibility,
      forked_from: input.forked_from ?? null, reproductions: 0, created_at: new Date().toISOString(),
    };
    cards.unshift(card);
    return clone(card);
  },
  updateCard(id: string, patch: Partial<Card>) {
    const c = cards.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
  },
  deleteCard(id: string) {
    const i = cards.findIndex((c) => c.id === id);
    if (i >= 0) cards.splice(i, 1);
  },
  addQuestion(input: Partial<Question>): Question {
    const q: Question = {
      id: newId("q"), author_id: ME, title: input.title ?? "", body: input.body ?? "",
      tags: input.tags ?? [], method_card_id: input.method_card_id ?? null,
      created_at: new Date().toISOString(),
    };
    questions.unshift(q);
    return clone(q);
  },
  addAnswer(qid: string, body: string) {
    answers.push({ id: newId("a"), question_id: qid, author_id: ME, body, accepted: false, created_at: new Date().toISOString() });
  },
  acceptAnswer(qid: string, aid: string) {
    answers.filter((a) => a.question_id === qid).forEach((a) => (a.accepted = a.id === aid));
  },
  addProject(input: Partial<Project>): Project {
    const p: Project = {
      id: newId("p"), owner_id: ME, title: input.title ?? "", summary: input.summary ?? "",
      status: "active", tags: input.tags ?? [], visibility: (input.visibility ?? "lab") as Visibility,
      created_at: new Date().toISOString(),
    };
    projects.unshift(p);
    members.push({ project_id: p.id, user_id: ME, role: "owner" });
    return clone(p);
  },
  addEntry(pid: string, body: string) {
    entries.unshift({ id: newId("e"), project_id: pid, author_id: ME, body, created_at: new Date().toISOString() });
  },
  addMessage(recipientId: string, body: string, cardId: string | null) {
    messages.push({ id: newId("m"), sender_id: ME, recipient_id: recipientId, body, method_card_id: cardId, read_at: null, created_at: new Date().toISOString() });
  },
  markRead(otherId: string) {
    messages.filter((m) => m.sender_id === otherId && m.recipient_id === ME).forEach((m) => (m.read_at ??= new Date().toISOString()));
  },
};
