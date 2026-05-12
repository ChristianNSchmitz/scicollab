// ============================================================
// SciCollab Mock Database — localStorage-backed, no Supabase needed
// Seed data mirrors the workflow blueprints from the deck.
// ============================================================

export type Reagent = { name: string; concentration: string; supplier: string };
export type AttachedFile = { name: string; type: string; size: string };

export type Experiment = {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  protocol_version: string;
  hypothesis: string | null;
  methods: string | null;
  conditions: string | null;
  reagents: Reagent[];
  technique_tags: string[];
  organism_tags: string[];
  outcome: "success" | "partial" | "failed" | null;
  outcome_summary: string | null;
  failure_context: string | null;
  root_cause: string | null;
  attached_files: AttachedFile[];
  code_notebook_url: string | null;
  visibility: "lab" | "network" | "public";
  co_authors: string[];
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string;
  institution: string;
  orcid_id: string | null;
  role: string;
  research_domain: string;
  techniques: string[];
};

export type Question = {
  id: string;
  experiment_id: string;
  user_id: string;
  body: string;
  created_at: string;
  answers: Answer[];
};

export type Answer = {
  id: string;
  question_id: string;
  user_id: string;
  body: string;
  is_endorsed: boolean;
  created_at: string;
};

// ── Seed profiles ────────────────────────────────────────────
const SEED_PROFILES: Profile[] = [
  { id: "user-park",   full_name: "Dr. L. Park",       institution: "Johns Hopkins",         orcid_id: "0000-0002-1234-5678", role: "PI",      research_domain: "Biochemistry",    techniques: ["Western Blot", "ELISA"] },
  { id: "user-mehta",  full_name: "R. Mehta",           institution: "MIT",                   orcid_id: null,                  role: "Postdoc", research_domain: "Cell Biology",    techniques: ["Western Blot", "Flow Cytometry"] },
  { id: "user-sato",   full_name: "T. Sato",            institution: "U Tokyo",               orcid_id: "0000-0003-9876-5432", role: "Postdoc", research_domain: "Proteomics",      techniques: ["Western Blot", "Mass Spec"] },
  { id: "user-gomez",  full_name: "A. Gomez",           institution: "IRB Barcelona",         orcid_id: null,                  role: "PhD",     research_domain: "Genome Editing",  techniques: ["CRISPR-Cas9", "NGS"] },
  { id: "user-nguyen", full_name: "P. Nguyen",          institution: "UCLA",                  orcid_id: "0000-0001-5555-1234", role: "PI",      research_domain: "Organoid Biology", techniques: ["Organoid Culture", "Confocal"] },
  { id: "user-osei",   full_name: "M. Osei",            institution: "ETH Zurich",            orcid_id: "0000-0004-7777-8888", role: "Postdoc", research_domain: "Genomics",        techniques: ["RNA-seq", "ChIP-seq"] },
];

// ── Seed experiments (the PPTX examples) ────────────────────
const SEED_EXPERIMENTS: Experiment[] = [
  {
    id: "exp-2041",
    user_id: "user-park",
    parent_id: null,
    title: "Western Blot Fix — pH Buffer Study (HEK293)",
    protocol_version: "v1.1",
    hypothesis: "Increasing transfer buffer pH from 8.3 to 8.6 recovers signal for high-MW proteins in HEK293 western blots.",
    methods: "1. Prepared HEK293 cell lysate at 2 mg/mL (BCA assay).\n2. Ran 10% SDS-PAGE at 120V, 90 min.\n3. Wet transfer to PVDF at 100V, 60 min — buffer pH adjusted to 8.6.\n4. Blocked 5% non-fat milk in TBST, 1h RT.\n5. Primary antibody overnight 4°C. Secondary HRP, 1h RT.\n6. ECL detection — 2× signal gain above 100kDa compared to pH 8.3 run.",
    conditions: "pH 8.6, 25mM Tris / 192mM glycine / 20% MeOH, HEK293, 2mg/mL, 60 min 100V",
    reagents: [
      { name: "Anti-GAPDH antibody", concentration: "1:1000",  supplier: "Cell Signaling #2118" },
      { name: "HRP secondary Ab",    concentration: "1:5000",  supplier: "Abcam ab205718" },
      { name: "PVDF membrane",        concentration: "0.45μm", supplier: "Millipore IPVH00010" },
    ],
    technique_tags: ["Western Blot"],
    organism_tags: ["Human (HEK293)"],
    outcome: "success",
    outcome_summary: "Raising transfer buffer pH from 8.3 → 8.6 yielded 2× signal gain for high-MW proteins (>100 kDa). Replicated across 3 independent lysates. Low-MW signal unaffected.",
    failure_context: null,
    root_cause: null,
    attached_files: [{ name: "blot_scan_pH8.6.tiff", type: "image/tiff", size: "3.8MB" }],
    code_notebook_url: null,
    visibility: "public",
    co_authors: [],
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "exp-2042",
    user_id: "user-mehta",
    parent_id: "exp-2041",
    title: "Western Blot — Low Signal HEK293, pH 8.3 Buffer (FAILED)",
    protocol_version: "v1.0",
    hypothesis: "Standard transfer buffer at pH 8.3 should be sufficient for HEK293 high-MW protein detection.",
    methods: "1. Prepared HEK293 cell lysate at 2mg/mL (BCA assay).\n2. Ran 10% SDS-PAGE at 120V for 90 min.\n3. Transferred to PVDF membrane using wet transfer at 100V for 60 min.\n4. Transfer buffer: 25mM Tris, 192mM glycine, 20% methanol, pH 8.3.\n5. Blocked with 5% non-fat milk in TBST for 1h at RT.\n6. Primary antibody overnight at 4°C. Secondary HRP-conjugated, 1h RT.\n7. ECL detection — signal in low-MW range but absent above 100kDa.",
    conditions: "pH 8.3, 25mM Tris / 192mM glycine / 20% MeOH, HEK293, 2mg/mL, 60 min 100V",
    reagents: [
      { name: "Anti-GAPDH antibody", concentration: "1:1000",  supplier: "Cell Signaling #2118" },
      { name: "HRP secondary Ab",    concentration: "1:5000",  supplier: "Abcam ab205718" },
      { name: "Non-fat milk",         concentration: "5% TBST", supplier: "—" },
      { name: "PVDF membrane",        concentration: "0.45μm", supplier: "Millipore IPVH00010" },
    ],
    technique_tags: ["Western Blot"],
    organism_tags: ["Human (HEK293)"],
    outcome: "failed",
    outcome_summary: "Signal detected only below 75 kDa. Proteins above 100 kDa consistently absent from membrane. Replicated across 3 attempts with same outcome.",
    failure_context: "Tried increasing transfer time to 90 min — no improvement. Switched from wet to semi-dry transfer at 25V for 30 min — actually worse. Checked gel integrity post-transfer (Coomassie stain) — high-MW bands visible in gel, confirming transfer failure not loading issue.",
    root_cause: "Buffer concentration error",
    attached_files: [
      { name: "blot_scan_attempt3.tiff", type: "image/tiff",  size: "4.2MB" },
      { name: "raw_signal_data.csv",     type: "text/csv",    size: "128KB" },
    ],
    code_notebook_url: null,
    visibility: "public",
    co_authors: [],
    created_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "exp-1987",
    user_id: "user-park",
    parent_id: null,
    title: "Methanol % Optimisation — High-MW Protein Transfer",
    protocol_version: "v2.0",
    hypothesis: "Reducing methanol from 20% to 15% in transfer buffer improves high-MW protein recovery.",
    methods: "Titrated methanol concentration from 10%–25% in standard Towbin buffer. Ran identical HEK293 lysate aliquots across all conditions. Assessed high-MW bands (100–250 kDa) by densitometry.",
    conditions: "15% MeOH, pH 8.3, HEK293, 90 min transfer, 80V",
    reagents: [
      { name: "Anti-Lamin A/C", concentration: "1:500", supplier: "Santa Cruz sc-376248" },
    ],
    technique_tags: ["Western Blot"],
    organism_tags: ["Human (HEK293)"],
    outcome: "success",
    outcome_summary: "15% methanol outperformed 20% for proteins >150 kDa by 1.8×. Below 75 kDa, no meaningful difference. Recommend 15% MeOH as default for high-MW blots.",
    failure_context: null,
    root_cause: null,
    attached_files: [{ name: "methanol_titration.xlsx", type: "spreadsheet", size: "512KB" }],
    code_notebook_url: null,
    visibility: "public",
    co_authors: ["user-mehta"],
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "exp-3182",
    user_id: "user-osei",
    parent_id: null,
    title: "RNA-seq Library Prep v3 — Validated Across 4 Tissue Types",
    protocol_version: "v3.0",
    hypothesis: "Updated library prep protocol (v3) using PolyA enrichment + UMI barcoding generalises to muscle, liver, brain, and kidney tissues.",
    methods: "1. Extracted total RNA from 4 tissue types (n=3 each) using TRIzol.\n2. Quality check: RIN >7 required.\n3. PolyA enrichment with Oligo-dT beads.\n4. cDNA synthesis + UMI ligation.\n5. PCR amplification 12 cycles.\n6. Size selection 200–500bp.\n7. Sequenced on NovaSeq 6000, 150bp paired-end.\n8. Mapped with STAR, quantified with featureCounts.",
    conditions: "RIN>7, 500ng input RNA, 12-cycle PCR, 150bp PE, NovaSeq 6000",
    reagents: [
      { name: "TRIzol", concentration: "1mL/50mg tissue", supplier: "Thermo 15596026" },
      { name: "NEBNext Ultra II", concentration: "1× kit", supplier: "NEB E7765" },
    ],
    technique_tags: ["RNA-seq", "Library Prep"],
    organism_tags: ["Mouse"],
    outcome: "success",
    outcome_summary: "Protocol validated across all 4 tissue types. Median mapping rate 93.2%. Duplication rates <15% with UMI deduplication. Coefficient of variation between technical replicates <5%.",
    failure_context: null,
    root_cause: null,
    attached_files: [
      { name: "QC_multiqc_report.html", type: "report",    size: "2.1MB" },
      { name: "count_matrix.tsv",       type: "text/tsv",  size: "18MB" },
    ],
    code_notebook_url: "https://github.com/osei-lab/rnaseq-pipeline",
    visibility: "public",
    co_authors: [],
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "exp-1849",
    user_id: "user-nguyen",
    parent_id: null,
    title: "Organoid Scale-up v2 — 5× Volume Failure",
    protocol_version: "v2.0",
    hypothesis: "Scaling organoid culture from 96-well to 24-well format (5× volume) should maintain viability and morphology.",
    methods: "1. Expanded intestinal organoids from established 96-well cultures.\n2. Transferred to 24-well format, scaling all volumes 5×.\n3. Same Matrigel concentration (8 mg/mL), ENR medium.\n4. Monitored for 14 days, daily brightfield imaging.\n5. Viability assay (CellTiter-Glo) at day 7 and 14.",
    conditions: "24-well plate, 8mg/mL Matrigel, ENR medium, 37°C 5% CO2, 5× volume",
    reagents: [
      { name: "Matrigel", concentration: "8 mg/mL", supplier: "Corning 356231" },
      { name: "EGF",      concentration: "50 ng/mL", supplier: "Peprotech 315-09" },
    ],
    technique_tags: ["Organoid Culture", "3D Cell Culture"],
    organism_tags: ["Human"],
    outcome: "failed",
    outcome_summary: "Complete failure across all 3 experimental replicates. Organoids collapsed by day 5 in all 24-well conditions. Day 7 viability <10% vs >85% in 96-well controls.",
    failure_context: "Suspected oxygen/nutrient diffusion failure at scale. Matrigel dome geometry may not support larger volumes. Tried reducing Matrigel to 6 mg/mL — no improvement. Added ROCK inhibitor on day 1 — no improvement.",
    root_cause: "Unknown — needs investigation",
    attached_files: [
      { name: "organoid_imaging_day5.zip", type: "archive", size: "24MB" },
      { name: "viability_data.xlsx",       type: "spreadsheet", size: "340KB" },
    ],
    code_notebook_url: null,
    visibility: "public",
    co_authors: [],
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "exp-4001",
    user_id: "user-gomez",
    parent_id: null,
    title: "CRISPR-Cas9 KO of PCSK9 — Optimised sgRNA Delivery",
    protocol_version: "v1.2",
    hypothesis: "Electroporation of Cas9 RNP with 2 sgRNAs targeting PCSK9 exon 2 achieves >80% editing efficiency in HepG2 cells.",
    methods: "1. Designed 2 sgRNAs targeting PCSK9 exon 2 (Benchling).\n2. Assembled Cas9 RNP: 10μM Cas9 protein + 12μM sgRNA, 10 min RT.\n3. Electroporated 2×10^5 HepG2 cells (Lonza 4D, CM-150 pulse).\n4. Recovery 48h in DMEM + 20% FBS.\n5. Genomic DNA extraction, PCR across cut site.\n6. ICE analysis for editing efficiency.",
    conditions: "HepG2, 2×10^5 cells, CM-150 pulse, 48h recovery, dual sgRNA",
    reagents: [
      { name: "SpCas9 protein",  concentration: "10μM",  supplier: "IDT 1081058" },
      { name: "sgRNA-1 (PCSK9)", concentration: "12μM",  supplier: "Synthego custom" },
      { name: "sgRNA-2 (PCSK9)", concentration: "12μM",  supplier: "Synthego custom" },
    ],
    technique_tags: ["CRISPR-Cas9", "Gene Editing"],
    organism_tags: ["Human (HepG2)"],
    outcome: "success",
    outcome_summary: "Achieved 87% indel efficiency by ICE analysis. Off-target analysis (Cas-OFFinder) showed no significant off-targets at top 10 predicted sites. Western blot confirmed PCSK9 protein loss in >80% of cells.",
    failure_context: null,
    root_cause: null,
    attached_files: [
      { name: "ICE_analysis_report.pdf", type: "application/pdf", size: "1.2MB" },
      { name: "western_blot_PCSK9.tiff", type: "image/tiff",      size: "5.1MB" },
    ],
    code_notebook_url: null,
    visibility: "public",
    co_authors: [],
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ── Seed Q&A ─────────────────────────────────────────────────
const SEED_QUESTIONS: Question[] = [
  {
    id: "q-001",
    experiment_id: "exp-2042",
    user_id: "user-mehta",
    body: "Same buffer composition but still losing signal above 100kDa — what am I missing?",
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    answers: [
      {
        id: "a-001",
        question_id: "q-001",
        user_id: "user-park",
        body: "Check methanol % in transfer buffer — >20% stiffens high-MW proteins and reduces elution from the gel. We solved this in Exp #1987 (see version 2). Reducing to 15% fixed it for us.",
        is_endorsed: true,
        created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "a-002",
        question_id: "q-001",
        user_id: "user-sato",
        body: "Also worth checking if your PVDF membrane was fully activated — incomplete methanol activation causes patchy transfer for large proteins. 30 sec in 100% MeOH, then equilibrate in transfer buffer.",
        is_endorsed: false,
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000 - 3600000).toISOString(),
      },
    ],
  },
  {
    id: "q-002",
    experiment_id: "exp-1849",
    user_id: "user-sato",
    body: "Did you try reducing the Matrigel concentration below 6 mg/mL? Some labs use 4 mg/mL for larger formats to improve oxygen diffusion.",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    answers: [],
  },
];

// ── localStorage keys ─────────────────────────────────────────
const KEY_EXPERIMENTS = "scicollab_experiments";
const KEY_QUESTIONS   = "scicollab_questions";
const KEY_PROFILE     = "scicollab_profile";

// ── Helpers ───────────────────────────────────────────────────
function ls<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ── Profile ───────────────────────────────────────────────────
export const MOCK_USER_ID = "mock-user";

export function getMockProfile(): Profile {
  const saved = ls<Profile | null>(KEY_PROFILE, null);
  return saved ?? {
    id: MOCK_USER_ID,
    full_name: "Researcher",
    institution: "",
    orcid_id: null,
    role: "",
    research_domain: "",
    techniques: [],
  };
}

export function saveMockProfile(p: Partial<Profile>) {
  const current = getMockProfile();
  lsSet(KEY_PROFILE, { ...current, ...p, id: MOCK_USER_ID });
}

export function getProfile(userId: string): Profile | null {
  if (userId === MOCK_USER_ID) return getMockProfile();
  return SEED_PROFILES.find((p) => p.id === userId) ?? null;
}

// ── Experiments ───────────────────────────────────────────────
export function getAllExperiments(): Experiment[] {
  const local = ls<Experiment[]>(KEY_EXPERIMENTS, []);
  return [...local, ...SEED_EXPERIMENTS];
}

export function getMyExperiments(): Experiment[] {
  return ls<Experiment[]>(KEY_EXPERIMENTS, []);
}

export function getExperiment(id: string): Experiment | null {
  const local = ls<Experiment[]>(KEY_EXPERIMENTS, []);
  return local.find((e) => e.id === id) ?? SEED_EXPERIMENTS.find((e) => e.id === id) ?? null;
}

export function saveExperiment(data: Omit<Experiment, "id" | "created_at">): Experiment {
  const newExp: Experiment = {
    ...data,
    id: `exp-${uid()}`,
    created_at: new Date().toISOString(),
  };
  const existing = ls<Experiment[]>(KEY_EXPERIMENTS, []);
  lsSet(KEY_EXPERIMENTS, [newExp, ...existing]);
  return newExp;
}

export function forkExperiment(source: Experiment): Experiment {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, ...rest } = source;
  return saveExperiment({
    ...rest,
    parent_id: source.id,
    user_id: MOCK_USER_ID,
    title: `${source.title} (fork)`,
    outcome: null,
    outcome_summary: null,
    failure_context: null,
    root_cause: null,
    attached_files: [],
    visibility: "lab",
    co_authors: [],
  });
}

export function searchExperiments(query: string): Array<Experiment & { matchPct: number }> {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const terms = q.split(/\s+/).filter(Boolean);
  const all = getAllExperiments().filter((e) => e.visibility === "public" || e.user_id === MOCK_USER_ID);

  function score(e: Experiment): number {
    let s = 0;
    for (const t of terms) {
      if (e.title?.toLowerCase().includes(t)) s += 50;
      if (e.technique_tags?.some((x) => x.toLowerCase().includes(t))) s += 30;
      if (e.organism_tags?.some((x) => x.toLowerCase().includes(t))) s += 25;
      if (e.conditions?.toLowerCase().includes(t)) s += 15;
      if (e.outcome_summary?.toLowerCase().includes(t)) s += 10;
      if (e.methods?.toLowerCase().includes(t)) s += 5;
      if (e.failure_context?.toLowerCase().includes(t)) s += 5;
    }
    return Math.min(99, Math.round(s / terms.length));
  }

  return all
    .map((e) => ({ ...e, matchPct: score(e) }))
    .filter((e) => e.matchPct > 0)
    .sort((a, b) => b.matchPct - a.matchPct);
}

// ── Q&A ───────────────────────────────────────────────────────
export function getQuestions(experimentId: string): Question[] {
  const local = ls<Question[]>(KEY_QUESTIONS, []);
  const seed = SEED_QUESTIONS.filter((q) => q.experiment_id === experimentId);
  const localFiltered = local.filter((q) => q.experiment_id === experimentId);
  return [...localFiltered, ...seed];
}

export function saveQuestion(experimentId: string, body: string): Question {
  const q: Question = {
    id: `q-${uid()}`,
    experiment_id: experimentId,
    user_id: MOCK_USER_ID,
    body,
    created_at: new Date().toISOString(),
    answers: [],
  };
  const all = ls<Question[]>(KEY_QUESTIONS, []);
  lsSet(KEY_QUESTIONS, [q, ...all]);
  return q;
}

export function saveAnswer(questionId: string, body: string): Answer {
  const a: Answer = {
    id: `a-${uid()}`,
    question_id: questionId,
    user_id: MOCK_USER_ID,
    body,
    is_endorsed: false,
    created_at: new Date().toISOString(),
  };
  const all = ls<Question[]>(KEY_QUESTIONS, []);
  lsSet(
    KEY_QUESTIONS,
    all.map((q) =>
      q.id === questionId ? { ...q, answers: [...q.answers, a] } : q
    )
  );
  return a;
}

export function endorseAnswer(questionId: string, answerId: string) {
  const all = ls<Question[]>(KEY_QUESTIONS, []);
  lsSet(
    KEY_QUESTIONS,
    all.map((q) =>
      q.id === questionId
        ? { ...q, answers: q.answers.map((a) => a.id === answerId ? { ...a, is_endorsed: true } : a) }
        : q
    )
  );
}
