// ============================================================
// SciCollab Mock Database — localStorage-backed prototype
// Covers: Experiments, Publications, Feed, Q&A, Notifications,
//         Profiles, Follows, Messages, Labs, Citations,
//         Comments, Privacy, Reports, Analytics
// ============================================================

// ─── Core types ──────────────────────────────────────────────

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  password: string;
  avatar_color: string;
  avatar_initials: string;
};

export type Reagent      = { name: string; concentration: string; supplier: string };
export type AttachedFile = { name: string; type: string; size: string };

export type Profile = {
  id: string;
  full_name: string;
  institution: string;
  orcid_id: string | null;
  google_scholar_id: string | null;
  semantic_scholar_id: string | null;
  role: string;
  research_domain: string;
  techniques: string[];
  // social network fields
  bio: string | null;
  avatar_initials: string;
  avatar_color: string;
  h_index: number;
  citation_count: number;
  publication_count: number;
  followers_count: number;
  following_count: number;
  skills: string[];
  grants: string[];
  social_links: { twitter?: string; github?: string; website?: string; linkedin?: string };
  is_verified: boolean;
  orcid_verified: boolean;
  profile_completeness: number;
  joined_at: string;
};

// ─── Feature types ───────────────────────────────────────────

export type Project = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  status: "active" | "completed" | "paused";
  git_url: string | null;
  publication_ids: string[];
  collaborator_ids: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type WikiPage = {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  content: string;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type IssueComment = {
  id: string;
  issue_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

export type Issue = {
  id: string;
  project_id: string;
  user_id: string;
  title: string;
  body: string;
  status: "open" | "closed" | "solved" | "in_process" | "waiting";
  priority: "low" | "medium" | "high";
  labels: string[];
  comments: IssueComment[];
  created_at: string;
};

export type Comment = {
  id: string;
  target_type: "experiment" | "publication" | "feedpost" | "project";
  target_id: string;
  user_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};

export type PrivacySettings = {
  profile_visibility: "public" | "network" | "private";
  email_visible: boolean;
  show_experiments: boolean;
  show_publications: boolean;
  allow_messages: "all" | "following" | "none";
  indexed_by_search: boolean;
};

export type Report = {
  id: string;
  reporter_id: string;
  target_type: "experiment" | "publication" | "comment" | "profile" | "feedpost";
  target_id: string;
  reason: "spam" | "misinformation" | "harassment" | "duplicate" | "other";
  details: string;
  status: "pending" | "reviewed" | "dismissed";
  created_at: string;
};

export type AnalyticsSeries = { date: string; value: number }[];
export type AuthorAnalytics = {
  profile_views: AnalyticsSeries;
  experiment_views: AnalyticsSeries;
  publication_views: AnalyticsSeries;
  total_forks: number;
  total_citations: number;
  total_followers_gained: number;
  top_experiments: Array<{ id: string; title: string; views: number; forks: number }>;
  top_publications: Array<{ id: string; title: string; views: number; citations: number }>;
};

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
  attachments?: { name: string; size: number; type: string; dataUrl: string }[];
  code_notebook_url: string | null;
  visibility: "lab" | "network" | "public";
  co_authors: string[];
  created_at: string;
};

export type Publication = {
  id: string;
  user_id: string;
  title: string;
  abstract: string | null;
  authors: string[];
  journal: string | null;
  year: number;
  doi: string | null;
  arxiv_id: string | null;
  type: "paper" | "preprint" | "dataset" | "code" | "thesis";
  tags: string[];
  citation_count: number;
  read_count: number;
  like_count: number;
  liked_by: string[];
  status: "published" | "preprint" | "draft";
  created_at: string;
};

export type FeedPost = {
  id: string;
  user_id: string;
  type: "experiment" | "publication" | "question" | "achievement" | "post";
  content: string;
  linked_experiment_id: string | null;
  linked_publication_id: string | null;
  linked_question_id: string | null;
  like_count: number;
  comment_count: number;
  repost_count: number;
  liked_by: string[];
  bookmarked_by: string[];
  created_at: string;
};

export type Follow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type Notification = {
  id: string;
  user_id: string;
  type:
    | "match"
    | "answer_request"
    | "fork"
    | "endorsement"
    | "version_update"
    | "follow"
    | "citation"
    | "collaboration_invite"
    | "publication_like"
    | "new_answer";
  title: string;
  body: string;
  linked_id: string | null;
  linked_type: "experiment" | "publication" | "question" | "profile" | null;
  is_read: boolean;
  created_at: string;
};

export type StandaloneQuestion = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  tags: string[];
  vote_count: number;
  view_count: number;
  is_answered: boolean;
  accepted_answer_id: string | null;
  answers: StandaloneAnswer[];
  created_at: string;
};

export type StandaloneAnswer = {
  id: string;
  question_id: string;
  user_id: string;
  body: string;
  vote_count: number;
  is_accepted: boolean;
  created_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

export type Conversation = {
  id: string;
  participant_ids: string[];
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
};

export type Lab = {
  id: string;
  name: string;
  institution: string;
  pi_user_id: string;
  members: Array<{ user_id: string; role: "pi" | "postdoc" | "phd" | "research_assistant" }>;
  description: string;
  research_areas: string[];
  experiment_count: number;
  publication_count: number;
  created_at: string;
};

// Legacy Q&A types (tied to experiments)
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

// ─── Helpers ─────────────────────────────────────────────────

function ls<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.warn("[SciCollab] localStorage write failed:", e);
  }
}
function uid() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

// ─── Auth helpers ─────────────────────────────────────────────
const KEY_USERS   = "scicollab_users";
const KEY_SESSION = "scicollab_session";

const AVATAR_COLORS = [
  "bg-blue-600", "bg-purple-600", "bg-emerald-600", "bg-orange-600",
  "bg-teal-600", "bg-indigo-600", "bg-rose-600", "bg-amber-600",
];

export function getCurrentUserId(): string {
  return ls<string>(KEY_SESSION, "mock-user");
}

export function setCurrentUserId(id: string): void {
  lsSet(KEY_SESSION, id);
}

export function registerUser(email: string, password: string, name: string): StoredUser {
  const users = ls<StoredUser[]>(KEY_USERS, []);
  const existing = users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    // Already registered — log them in
    setCurrentUserId(existing.id);
    return existing;
  }
  const parts = name.trim().split(" ");
  const initials = parts.length > 1
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
    : name[0]?.toUpperCase() ?? "R";
  const color = AVATAR_COLORS[users.length % AVATAR_COLORS.length];
  const newUser: StoredUser = {
    id: `user-${uid()}`,
    email,
    name,
    password,
    avatar_color: color,
    avatar_initials: initials,
  };
  lsSet(KEY_USERS, [...users, newUser]);
  setCurrentUserId(newUser.id);
  return newUser;
}

export function loginUser(email: string, password: string): StoredUser | null {
  const users = ls<StoredUser[]>(KEY_USERS, []);
  const user = users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );
  if (!user) return null;
  setCurrentUserId(user.id);
  return user;
}

export function logoutUser(): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(KEY_SESSION); } catch { /* noop */ }
}

export function getMockUserId(): string {
  return getCurrentUserId();
}

// ─── localStorage keys ────────────────────────────────────────
const KEY_EXPERIMENTS   = "scicollab_experiments";
const KEY_QUESTIONS     = "scicollab_questions";
const KEY_PROFILE       = "scicollab_profile";
const KEY_PUBLICATIONS  = "scicollab_publications";
const KEY_FEED          = "scicollab_feed";
const KEY_FOLLOWS       = "scicollab_follows";
const KEY_NOTIFICATIONS = "scicollab_notifications";
const KEY_SQ            = "scicollab_sq";          // standalone questions
const KEY_MESSAGES      = "scicollab_messages";
const KEY_CONVOS        = "scicollab_convos";
const KEY_COMMENTS      = "scicollab_comments";
const KEY_PRIVACY       = "scicollab_privacy";
const KEY_REPORTS       = "scicollab_reports";
const KEY_PROJECTS      = "scicollab_projects";
const KEY_WIKI          = "scicollab_wiki";
const KEY_ISSUES        = "scicollab_issues";

// ─── Seed data ────────────────────────────────────────────────

export const MOCK_USER_ID = "mock-user";

const SEED_PROFILES: Profile[] = [
  {
    id: "user-park",
    full_name: "Dr. L. Park",
    institution: "Johns Hopkins University",
    orcid_id: "0000-0002-1234-5678",
    google_scholar_id: "Lz_Park_Scholar",
    semantic_scholar_id: null,
    role: "PI",
    research_domain: "Biochemistry",
    techniques: ["Western Blot", "ELISA", "Immunoprecipitation"],
    bio: "Principal Investigator studying protein trafficking and membrane transport. 15 years of experience in biochemical assay development. Author of 60+ peer-reviewed papers.",
    avatar_initials: "LP",
    avatar_color: "bg-blue-600",
    h_index: 28,
    citation_count: 3420,
    publication_count: 62,
    followers_count: 412,
    following_count: 89,
    skills: ["Western Blot", "ELISA", "Protein Purification", "Structural Biology"],
    grants: ["NIH R01 GM123456", "NSF MCB-2012345"],
    social_links: { twitter: "@lpark_lab", github: "lpark-jhu" },
    is_verified: true,
    orcid_verified: true,
    profile_completeness: 95,
    joined_at: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "user-mehta",
    full_name: "R. Mehta",
    institution: "MIT",
    orcid_id: null,
    google_scholar_id: null,
    semantic_scholar_id: null,
    role: "Postdoc",
    research_domain: "Cell Biology",
    techniques: ["Western Blot", "Flow Cytometry", "Confocal Microscopy"],
    bio: "Postdoctoral researcher investigating cytoskeletal dynamics and cell migration. Passionate about reproducible science and open data.",
    avatar_initials: "RM",
    avatar_color: "bg-purple-600",
    h_index: 8,
    citation_count: 312,
    publication_count: 11,
    followers_count: 87,
    following_count: 134,
    skills: ["Flow Cytometry", "Western Blot", "MATLAB", "Python"],
    grants: [],
    social_links: { github: "rmehta-mit" },
    is_verified: false,
    orcid_verified: false,
    profile_completeness: 72,
    joined_at: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "user-sato",
    full_name: "T. Sato",
    institution: "University of Tokyo",
    orcid_id: "0000-0003-9876-5432",
    google_scholar_id: null,
    semantic_scholar_id: null,
    role: "Postdoc",
    research_domain: "Proteomics",
    techniques: ["Western Blot", "Mass Spectrometry", "2D-PAGE"],
    bio: "Proteomics specialist with expertise in mass spectrometry-based protein quantification. Currently building open proteomics pipelines.",
    avatar_initials: "TS",
    avatar_color: "bg-emerald-600",
    h_index: 12,
    citation_count: 780,
    publication_count: 18,
    followers_count: 203,
    following_count: 76,
    skills: ["Mass Spectrometry", "Proteomics", "R", "Bioinformatics"],
    grants: ["JSPS Postdoctoral Fellowship"],
    social_links: { twitter: "@tsato_proteomics" },
    is_verified: true,
    orcid_verified: true,
    profile_completeness: 88,
    joined_at: new Date(Date.now() - 290 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "user-gomez",
    full_name: "A. Gomez",
    institution: "IRB Barcelona",
    orcid_id: null,
    google_scholar_id: null,
    semantic_scholar_id: null,
    role: "PhD Student",
    research_domain: "Genome Editing",
    techniques: ["CRISPR-Cas9", "NGS", "PCR"],
    bio: "PhD candidate developing CRISPR screens for cancer vulnerabilities. Open science advocate.",
    avatar_initials: "AG",
    avatar_color: "bg-orange-600",
    h_index: 4,
    citation_count: 89,
    publication_count: 5,
    followers_count: 156,
    following_count: 210,
    skills: ["CRISPR-Cas9", "Genome Editing", "Python", "Nextflow"],
    grants: [],
    social_links: { github: "agomez-irb", twitter: "@gomez_crispr" },
    is_verified: false,
    orcid_verified: false,
    profile_completeness: 80,
    joined_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "user-nguyen",
    full_name: "Prof. P. Nguyen",
    institution: "UCLA",
    orcid_id: "0000-0001-5555-1234",
    google_scholar_id: null,
    semantic_scholar_id: null,
    role: "PI",
    research_domain: "Organoid Biology",
    techniques: ["Organoid Culture", "Confocal Microscopy", "Single-cell RNA-seq"],
    bio: "UCLA Professor building next-generation organoid models for drug screening. Founder of the Open Organoid Consortium.",
    avatar_initials: "PN",
    avatar_color: "bg-teal-600",
    h_index: 22,
    citation_count: 2180,
    publication_count: 38,
    followers_count: 678,
    following_count: 45,
    skills: ["Organoid Biology", "Drug Screening", "Stem Cells", "3D Culture"],
    grants: ["NIH R35 GM456789", "Chan Zuckerberg Initiative"],
    social_links: { twitter: "@nguyen_organoids", website: "https://nguyenlab.ucla.edu" },
    is_verified: true,
    orcid_verified: true,
    profile_completeness: 98,
    joined_at: new Date(Date.now() - 500 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "user-osei",
    full_name: "M. Osei",
    institution: "ETH Zurich",
    orcid_id: "0000-0004-7777-8888",
    google_scholar_id: null,
    semantic_scholar_id: null,
    role: "Postdoc",
    research_domain: "Genomics",
    techniques: ["RNA-seq", "ChIP-seq", "ATAC-seq"],
    bio: "Genomics researcher specialising in chromatin remodelling and gene regulation. Building reproducible bioinformatics pipelines.",
    avatar_initials: "MO",
    avatar_color: "bg-indigo-600",
    h_index: 10,
    citation_count: 540,
    publication_count: 14,
    followers_count: 245,
    following_count: 98,
    skills: ["RNA-seq", "ChIP-seq", "Snakemake", "Python", "R"],
    grants: ["Swiss National Science Foundation Postdoc.Mobility"],
    social_links: { github: "mosei-eth" },
    is_verified: true,
    orcid_verified: true,
    profile_completeness: 91,
    joined_at: new Date(Date.now() - 220 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

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
      { name: "Anti-GAPDH antibody", concentration: "1:1000", supplier: "Cell Signaling #2118" },
      { name: "HRP secondary Ab",    concentration: "1:5000", supplier: "Abcam ab205718" },
      { name: "PVDF membrane",       concentration: "0.45μm", supplier: "Millipore IPVH00010" },
    ],
    technique_tags: ["Western Blot"],
    organism_tags: ["Human (HEK293)"],
    outcome: "success",
    outcome_summary: "Raising transfer buffer pH from 8.3 → 8.6 yielded 2× signal gain for high-MW proteins (>100 kDa). Replicated across 3 independent lysates.",
    failure_context: null, root_cause: null,
    attached_files: [{ name: "blot_scan_pH8.6.tiff", type: "image/tiff", size: "3.8MB" }],
    code_notebook_url: null, visibility: "public", co_authors: [],
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "exp-2042",
    user_id: "user-mehta",
    parent_id: "exp-2041",
    title: "Western Blot — Low Signal HEK293, pH 8.3 Buffer (FAILED)",
    protocol_version: "v1.0",
    hypothesis: "Standard transfer buffer at pH 8.3 should be sufficient for HEK293 high-MW protein detection.",
    methods: "Standard SDS-PAGE + wet transfer protocol. Transfer buffer pH 8.3, 20% methanol.",
    conditions: "pH 8.3, 25mM Tris / 192mM glycine / 20% MeOH, HEK293, 2mg/mL, 60 min 100V",
    reagents: [
      { name: "Anti-GAPDH antibody", concentration: "1:1000",  supplier: "Cell Signaling #2118" },
      { name: "Non-fat milk",         concentration: "5% TBST", supplier: "—" },
    ],
    technique_tags: ["Western Blot"], organism_tags: ["Human (HEK293)"],
    outcome: "failed",
    outcome_summary: "Signal detected only below 75 kDa. Proteins above 100 kDa consistently absent from membrane.",
    failure_context: "Tried increasing transfer time to 90 min — no improvement. Semi-dry at 25V for 30 min — worse. Gel integrity confirmed post-transfer (Coomassie stain).",
    root_cause: "Buffer concentration error",
    attached_files: [{ name: "blot_scan_attempt3.tiff", type: "image/tiff", size: "4.2MB" }],
    code_notebook_url: null, visibility: "public", co_authors: [],
    created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: "exp-1987",
    user_id: "user-park",
    parent_id: null,
    title: "Methanol % Optimisation — High-MW Protein Transfer",
    protocol_version: "v2.0",
    hypothesis: "Reducing methanol from 20% to 15% improves high-MW protein recovery.",
    methods: "Titrated methanol concentration from 10%–25%. Densitometry on high-MW bands (100–250 kDa).",
    conditions: "15% MeOH, pH 8.3, HEK293, 90 min transfer, 80V",
    reagents: [{ name: "Anti-Lamin A/C", concentration: "1:500", supplier: "Santa Cruz sc-376248" }],
    technique_tags: ["Western Blot"], organism_tags: ["Human (HEK293)"],
    outcome: "success",
    outcome_summary: "15% methanol outperformed 20% for proteins >150 kDa by 1.8×. Recommend 15% MeOH as default for high-MW blots.",
    failure_context: null, root_cause: null,
    attached_files: [{ name: "methanol_titration.xlsx", type: "spreadsheet", size: "512KB" }],
    code_notebook_url: null, visibility: "public", co_authors: ["user-mehta"],
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: "exp-3182",
    user_id: "user-osei",
    parent_id: null,
    title: "RNA-seq Library Prep v3 — Validated Across 4 Tissue Types",
    protocol_version: "v3.0",
    hypothesis: "Updated library prep (v3) with PolyA enrichment + UMI barcoding generalises to muscle, liver, brain, and kidney tissues.",
    methods: "TRIzol RNA extraction → PolyA enrichment → UMI ligation → PCR 12 cycles → size selection 200–500bp → NovaSeq 6000, 150bp PE. Mapped with STAR, quantified with featureCounts.",
    conditions: "RIN>7, 500ng input RNA, 12-cycle PCR, 150bp PE, NovaSeq 6000",
    reagents: [
      { name: "TRIzol", concentration: "1mL/50mg tissue", supplier: "Thermo 15596026" },
      { name: "NEBNext Ultra II", concentration: "1× kit", supplier: "NEB E7765" },
    ],
    technique_tags: ["RNA-seq", "Library Prep"], organism_tags: ["Mouse"],
    outcome: "success",
    outcome_summary: "Protocol validated across all 4 tissue types. Median mapping rate 93.2%. Duplication rates <15%. CV between technical replicates <5%.",
    failure_context: null, root_cause: null,
    attached_files: [{ name: "QC_multiqc_report.html", type: "report", size: "2.1MB" }],
    code_notebook_url: "https://github.com/osei-lab/rnaseq-pipeline",
    visibility: "public", co_authors: [],
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "exp-1849",
    user_id: "user-nguyen",
    parent_id: null,
    title: "Organoid Scale-up v2 — 5× Volume Failure",
    protocol_version: "v2.0",
    hypothesis: "Scaling organoid culture from 96-well to 24-well format (5× volume) maintains viability and morphology.",
    methods: "Expanded intestinal organoids to 24-well format. Same Matrigel (8 mg/mL), ENR medium. Monitored 14 days, CellTiter-Glo at day 7 and 14.",
    conditions: "24-well plate, 8mg/mL Matrigel, ENR medium, 37°C 5% CO2, 5× volume",
    reagents: [
      { name: "Matrigel", concentration: "8 mg/mL", supplier: "Corning 356231" },
      { name: "EGF",      concentration: "50 ng/mL", supplier: "Peprotech 315-09" },
    ],
    technique_tags: ["Organoid Culture", "3D Cell Culture"], organism_tags: ["Human"],
    outcome: "failed",
    outcome_summary: "Complete failure across all 3 replicates. Organoids collapsed by day 5. Day 7 viability <10% vs >85% in 96-well controls.",
    failure_context: "Suspected oxygen/nutrient diffusion failure at scale. Tried 6 mg/mL Matrigel — no improvement. ROCK inhibitor added day 1 — no improvement.",
    root_cause: "Unknown — needs investigation",
    attached_files: [{ name: "organoid_imaging_day5.zip", type: "archive", size: "24MB" }],
    code_notebook_url: null, visibility: "public", co_authors: [],
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "exp-4001",
    user_id: "user-gomez",
    parent_id: null,
    title: "CRISPR-Cas9 KO of PCSK9 — Optimised sgRNA Delivery",
    protocol_version: "v1.2",
    hypothesis: "Electroporation of Cas9 RNP with 2 sgRNAs targeting PCSK9 exon 2 achieves >80% editing efficiency in HepG2 cells.",
    methods: "Designed 2 sgRNAs (Benchling). Assembled Cas9 RNP: 10μM Cas9 + 12μM sgRNA. Electroporated 2×10^5 HepG2 cells (Lonza 4D, CM-150). Recovery 48h. ICE analysis.",
    conditions: "HepG2, 2×10^5 cells, CM-150 pulse, 48h recovery, dual sgRNA",
    reagents: [
      { name: "SpCas9 protein",  concentration: "10μM", supplier: "IDT 1081058" },
      { name: "sgRNA-1 (PCSK9)", concentration: "12μM", supplier: "Synthego custom" },
    ],
    technique_tags: ["CRISPR-Cas9", "Gene Editing"], organism_tags: ["Human (HepG2)"],
    outcome: "success",
    outcome_summary: "87% indel efficiency by ICE analysis. No significant off-targets. Western blot confirmed PCSK9 protein loss in >80% of cells.",
    failure_context: null, root_cause: null,
    attached_files: [{ name: "ICE_analysis_report.pdf", type: "application/pdf", size: "1.2MB" }],
    code_notebook_url: null, visibility: "public", co_authors: [],
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

const SEED_QUESTIONS: Question[] = [
  {
    id: "q-001", experiment_id: "exp-2042", user_id: "user-mehta",
    body: "Same buffer composition but still losing signal above 100kDa — what am I missing?",
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
    answers: [
      { id: "a-001", question_id: "q-001", user_id: "user-park",
        body: "Check methanol % in transfer buffer — >20% stiffens high-MW proteins. We solved this in Exp #1987. Reducing to 15% fixed it for us.",
        is_endorsed: true, created_at: new Date(Date.now() - 6 * 86400000).toISOString() },
      { id: "a-002", question_id: "q-001", user_id: "user-sato",
        body: "Also check if PVDF was fully activated — 30 sec in 100% MeOH, then equilibrate in transfer buffer.",
        is_endorsed: false, created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
    ],
  },
  {
    id: "q-002", experiment_id: "exp-1849", user_id: "user-sato",
    body: "Did you try reducing Matrigel below 6 mg/mL? Some labs use 4 mg/mL for larger formats to improve oxygen diffusion.",
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    answers: [],
  },
];

const SEED_PUBLICATIONS: Publication[] = [
  {
    id: "pub-001", user_id: "user-park",
    title: "Optimised Western Blot Transfer Conditions for High-Molecular-Weight Proteins",
    abstract: "We systematically evaluated transfer buffer conditions for proteins >100 kDa and identified pH and methanol concentration as critical parameters. Raising transfer buffer pH from 8.3 to 8.6 combined with reducing methanol to 15% yielded a 2.3× improvement in signal recovery for high-MW targets.",
    authors: ["L. Park", "R. Mehta", "T. Sato"],
    journal: "Journal of Proteome Research", year: 2024, doi: "10.1021/acs.jproteomer.4b00123",
    arxiv_id: null, type: "paper", tags: ["Western Blot", "Proteomics", "Methods"],
    citation_count: 42, read_count: 1280, like_count: 87, liked_by: [],
    status: "published", created_at: new Date(Date.now() - 45 * 86400000).toISOString(),
  },
  {
    id: "pub-002", user_id: "user-gomez",
    title: "Dual-sgRNA CRISPR-Cas9 Strategy for Efficient PCSK9 Disruption in Hepatocytes",
    abstract: "We present an optimised electroporation-based CRISPR-Cas9 delivery strategy achieving >85% editing efficiency in HepG2 hepatocytes with minimal off-target activity. Our dual-sgRNA approach generates defined deletions in PCSK9 exon 2.",
    authors: ["A. Gomez", "J. Martinez", "L. Park"],
    journal: "CRISPR Journal", year: 2024, doi: "10.1089/crispr.2024.0045",
    arxiv_id: "2403.12345", type: "paper", tags: ["CRISPR-Cas9", "Gene Editing", "PCSK9"],
    citation_count: 28, read_count: 945, like_count: 63, liked_by: [],
    status: "published", created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
  },
  {
    id: "pub-003", user_id: "user-osei",
    title: "Universal RNA-seq Library Preparation Protocol with UMI-based Deduplication",
    abstract: "We describe a validated RNA-seq library preparation protocol suitable for diverse tissue types. Using UMI barcoding and optimised PolyA enrichment, we achieve >90% mapping rates and <15% duplication rates across muscle, liver, brain and kidney samples.",
    authors: ["M. Osei", "K. Brandt"],
    journal: null, year: 2024, doi: null, arxiv_id: "2405.67890",
    type: "preprint", tags: ["RNA-seq", "Genomics", "Library Prep"],
    citation_count: 7, read_count: 412, like_count: 34, liked_by: [],
    status: "preprint", created_at: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: "pub-004", user_id: "user-nguyen",
    title: "Scale-dependent Failure Modes in Intestinal Organoid Culture Systems",
    abstract: "Systematic analysis of organoid viability across well-plate formats reveals critical oxygen and nutrient diffusion limits. We characterise failure modes at 5× scale-up and propose mitigation strategies including perfusion-based culture systems.",
    authors: ["P. Nguyen", "S. Chen", "M. Rodriguez"],
    journal: "Cell Reports Methods", year: 2023, doi: "10.1016/j.crmeth.2023.100678",
    arxiv_id: null, type: "paper", tags: ["Organoid Culture", "Stem Cells", "Scale-up"],
    citation_count: 156, read_count: 3890, like_count: 201, liked_by: [],
    status: "published", created_at: new Date(Date.now() - 200 * 86400000).toISOString(),
  },
  {
    id: "pub-005", user_id: "user-osei",
    title: "Chromatin Accessibility Atlas of Mouse Tissue Development",
    abstract: "ATAC-seq profiling of 12 mouse tissues across 5 developmental stages reveals tissue-specific regulatory elements and transcription factor networks governing cell identity.",
    authors: ["M. Osei", "R. Sharma", "A. Kowalski"],
    journal: "Nature Communications", year: 2023, doi: "10.1038/s41467-023-43210-1",
    arxiv_id: null, type: "paper", tags: ["ATAC-seq", "Chromatin", "Development"],
    citation_count: 89, read_count: 2340, like_count: 128, liked_by: [],
    status: "published", created_at: new Date(Date.now() - 180 * 86400000).toISOString(),
  },
];

const SEED_FEED: FeedPost[] = [
  {
    id: "feed-001", user_id: "user-park", type: "publication",
    content: "Our new paper on Western blot buffer optimisation is out in JPR! After 3 years of troubleshooting high-MW protein detection, we finally have a definitive answer on pH and methanol interactions. Open access — link in bio. 🧫",
    linked_experiment_id: null, linked_publication_id: "pub-001", linked_question_id: null,
    like_count: 94, comment_count: 12, repost_count: 31, liked_by: [], bookmarked_by: [],
    created_at: new Date(Date.now() - 44 * 86400000).toISOString(),
  },
  {
    id: "feed-002", user_id: "user-nguyen", type: "achievement",
    content: "Excited to announce our lab received the Chan Zuckerberg Initiative grant to build the next generation of intestinal organoid disease models! Thank you to our amazing team and collaborators. This will fund 3 years of open science. 🎉",
    linked_experiment_id: null, linked_publication_id: null, linked_question_id: null,
    like_count: 287, comment_count: 43, repost_count: 62, liked_by: [], bookmarked_by: [],
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "feed-003", user_id: "user-gomez", type: "experiment",
    content: "Just uploaded our CRISPR-Cas9 PCSK9 knockout protocol — 87% editing efficiency in HepG2 cells. Full method card with all conditions is now searchable. This one took 6 months to optimise — hope it saves someone time! 🔬",
    linked_experiment_id: "exp-4001", linked_publication_id: null, linked_question_id: null,
    like_count: 56, comment_count: 8, repost_count: 19, liked_by: [], bookmarked_by: [],
    created_at: new Date(Date.now() - 19 * 86400000).toISOString(),
  },
  {
    id: "feed-004", user_id: "user-osei", type: "post",
    content: "Hot take: The biggest problem in genomics reproducibility isn't statistical — it's undocumented library prep variations. We're building a protocol registry to fix this. Who wants to collaborate? Drop your email below 👇",
    linked_experiment_id: null, linked_publication_id: null, linked_question_id: null,
    like_count: 143, comment_count: 38, repost_count: 27, liked_by: [], bookmarked_by: [],
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "feed-005", user_id: "user-mehta", type: "post",
    content: "PSA: If your high-MW western blots keep failing, check your methanol %. Spent 3 weeks debugging before finding Dr. Park's method card on SciCollab. Community knowledge sharing works! 🙏",
    linked_experiment_id: "exp-2041", linked_publication_id: null, linked_question_id: null,
    like_count: 72, comment_count: 15, repost_count: 22, liked_by: [], bookmarked_by: [],
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "feed-006", user_id: "user-sato", type: "publication",
    content: "Our chromatin accessibility atlas is now published in Nature Communications — 12 tissues, 5 developmental stages, fully open dataset. All raw data on GEO. Data analysis pipeline on GitHub. Science should be open! 🌐",
    linked_experiment_id: null, linked_publication_id: "pub-005", linked_question_id: null,
    like_count: 118, comment_count: 22, repost_count: 45, liked_by: [], bookmarked_by: [],
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
];

const SEED_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-001", user_id: MOCK_USER_ID, type: "match",
    title: "New experiment matches your expertise",
    body: "A. Gomez (IRB Barcelona) uploaded a CRISPR-Cas9 experiment matching your technique tags — 87% editing efficiency in HepG2 cells.",
    linked_id: "exp-4001", linked_type: "experiment", is_read: false,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: "notif-002", user_id: MOCK_USER_ID, type: "answer_request",
    title: "Your expertise is needed",
    body: "R. Mehta (MIT) linked your Exp #2041 and asked a question about transfer buffer pH. Your technique tags match this question.",
    linked_id: "q-001", linked_type: "question", is_read: false,
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "notif-003", user_id: MOCK_USER_ID, type: "fork",
    title: "Your protocol was forked",
    body: "Your protocol 'Western Blot Fix — pH Buffer Study' was forked by 3 new researchers this week. View their adaptations.",
    linked_id: "exp-2041", linked_type: "experiment", is_read: false,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "notif-004", user_id: MOCK_USER_ID, type: "endorsement",
    title: "Your answer was endorsed",
    body: "Prof. L. Park endorsed your answer as the best solution for HEK293 western blot troubleshooting. +1 reputation.",
    linked_id: "q-001", linked_type: "question", is_read: true,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "notif-005", user_id: MOCK_USER_ID, type: "version_update",
    title: "Protocol you forked was updated",
    body: "Western Blot Fix v1.1 (which you forked) has been updated to v1.2 by Dr. L. Park — review changes.",
    linked_id: "exp-2041", linked_type: "experiment", is_read: true,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "notif-006", user_id: MOCK_USER_ID, type: "collaboration_invite",
    title: "Collaboration invite",
    body: "Cold Spring Harbor Open Lab invites you to co-author a shared protocol based on your method card. 3 PIs already joined.",
    linked_id: null, linked_type: null, is_read: true,
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "notif-007", user_id: MOCK_USER_ID, type: "follow",
    title: "New follower",
    body: "Prof. P. Nguyen (UCLA) started following you.",
    linked_id: "user-nguyen", linked_type: "profile", is_read: true,
    created_at: new Date(Date.now() - 14 * 86400000).toISOString(),
  },
  {
    id: "notif-008", user_id: MOCK_USER_ID, type: "citation",
    title: "Your experiment was cited",
    body: "Your method card 'Western Blot Fix' was cited in a new paper: 'Optimised WB Conditions for High-MW Proteins' by Park et al., JPR 2024.",
    linked_id: "pub-001", linked_type: "publication", is_read: true,
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
];

const SEED_STANDALONE_QUESTIONS: StandaloneQuestion[] = [
  {
    id: "sq-001", user_id: "user-mehta",
    title: "Best approach for single-cell RNA-seq on frozen tissue samples?",
    body: "We have a large biobank of frozen tissue samples (snap-frozen at -80°C) and want to do scRNA-seq. What's the best nuclei isolation protocol? We've tried 10x Genomics snRNA-seq but get variable quality across samples.",
    tags: ["RNA-seq", "Single-cell", "Nuclei Isolation"],
    vote_count: 34, view_count: 892, is_answered: true,
    accepted_answer_id: "sqa-001",
    answers: [
      { id: "sqa-001", question_id: "sq-001", user_id: "user-osei",
        body: "For frozen tissue, I'd strongly recommend the 10x Chromium nuclei isolation protocol with the Nuclei PURE Prep kit. Key steps: (1) 5-10 min lysis in Nuclei Buffer, (2) filter through 30μm MACS strainer, (3) check nuclei integrity before loading. We published a benchmarking paper on this — DM me for the preprint.",
        vote_count: 28, is_accepted: true, created_at: new Date(Date.now() - 8 * 86400000).toISOString() },
      { id: "sqa-002", question_id: "sq-001", user_id: "user-nguyen",
        body: "Alternative: Parse Biosciences SPLiT-seq works remarkably well on frozen samples in our hands. No need for nuclei isolation — directly fixes whole cells. Lower per-cell cost too.",
        vote_count: 14, is_accepted: false, created_at: new Date(Date.now() - 7 * 86400000).toISOString() },
    ],
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "sq-002", user_id: "user-gomez",
    title: "CRISPR screen — MAGeCK vs BAGEL2 for hit calling?",
    body: "Running a genome-wide CRISPR knockout screen (n=2 replicates). Trying to decide between MAGeCK MLE and BAGEL2 for essential gene identification. Any experience with both? Our library is the Brunello human library.",
    tags: ["CRISPR-Cas9", "Genetic Screen", "Bioinformatics"],
    vote_count: 19, view_count: 567, is_answered: false,
    accepted_answer_id: null,
    answers: [
      { id: "sqa-003", question_id: "sq-002", user_id: "user-osei",
        body: "With 2 replicates, MAGeCK MLE is generally more robust. BAGEL2 needs at least 3 replicates for reliable Bayes Factor estimation. Also make sure your sequencing depth is >300 reads/sgRNA — undercoverage kills both tools.",
        vote_count: 11, is_accepted: false, created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
    ],
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: "sq-003", user_id: "user-sato",
    title: "Protein co-IP from low-abundance nuclear complexes — any tips?",
    body: "Trying to co-immunoprecipitate a transcription factor complex from nuclear extracts. Inputs look fine but IP pulls down very little. Complex is estimated <50,000 copies/cell. Antibody is validated for ChIP.",
    tags: ["Immunoprecipitation", "Nuclear Proteins", "Biochemistry"],
    vote_count: 27, view_count: 743, is_answered: false,
    accepted_answer_id: null, answers: [],
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "sq-004", user_id: "user-nguyen",
    title: "Matrigel dome vs embedded culture for organoid drug screening?",
    body: "Setting up a drug screening pipeline with intestinal organoids. Need to choose between dome and embedded format. Key concerns: throughput, reproducibility, and compatibility with automated liquid handlers.",
    tags: ["Organoid Culture", "Drug Screening", "High-throughput"],
    vote_count: 41, view_count: 1240, is_answered: true,
    accepted_answer_id: "sqa-005",
    answers: [
      { id: "sqa-005", question_id: "sq-004", user_id: "user-nguyen",
        body: "For HTS, embedded is far superior. Dome format has edge effects and poor liquid handler compatibility. We use 1.5% Matrigel in 384-well format — flat-bottom plates, 2μL gel drops, automated dispensing with Mosquito HTS. Happy to share our detailed SOP.",
        vote_count: 35, is_accepted: true, created_at: new Date(Date.now() - 20 * 86400000).toISOString() },
    ],
    created_at: new Date(Date.now() - 22 * 86400000).toISOString(),
  },
];

const SEED_PROJECTS: Project[] = [
  {
    id: "proj-1",
    user_id: "user-park",
    title: "Western Blot Optimisation Series",
    description: "A systematic study of transfer buffer conditions, methanol percentages, and blocking agents for improved high-MW protein detection in HEK293 cells.",
    status: "active",
    git_url: "https://github.com/lpark-jhu/wb-optimisation",
    publication_ids: ["pub-001", "pub-002"],
    collaborator_ids: ["user-mehta"],
    tags: ["Western Blot", "Proteomics", "Methods"],
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: "proj-2",
    user_id: "user-osei",
    title: "Open RNA-seq Pipeline v3",
    description: "Reproducible, container-based RNA-seq pipeline validated across multiple tissue types. All code open-source on GitHub.",
    status: "active",
    git_url: "https://github.com/mosei-eth/rnaseq-pipeline",
    publication_ids: ["pub-003", "pub-005"],
    collaborator_ids: ["user-sato"],
    tags: ["RNA-seq", "Bioinformatics", "Open Source"],
    created_at: new Date(Date.now() - 60 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
];

const SEED_WIKI: WikiPage[] = [
  {
    id: "wiki-1a",
    project_id: "proj-1",
    parent_id: null,
    title: "Protocol Overview",
    content: "This project systematically evaluates western blot transfer conditions. We vary pH (8.3–8.8), methanol (10–25%), and blocking agents (milk vs BSA) to find optimal conditions for high-MW proteins in HEK293 cells.\n\nKey findings so far: pH 8.6 + 15% MeOH yields best results for proteins >100 kDa.",
    created_by: "user-park",
    created_at: new Date(Date.now() - 28 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "wiki-1b",
    project_id: "proj-1",
    parent_id: "wiki-1a",
    title: "Reagents & Equipment",
    content: "Standard reagents used across all experiments:\n- PVDF membrane 0.45μm (Millipore)\n- Anti-GAPDH 1:1000 (Cell Signaling #2118)\n- HRP secondary 1:5000 (Abcam ab205718)\n- ECL substrate (Thermo)\n\nEquipment: Bio-Rad Trans-Blot Turbo, ChemiDoc MP.",
    created_by: "user-park",
    created_at: new Date(Date.now() - 25 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: "wiki-2a",
    project_id: "proj-2",
    parent_id: null,
    title: "Pipeline Architecture",
    content: "The RNA-seq pipeline uses Snakemake for workflow management and Docker for reproducibility.\n\nSteps: FastQC → Trim Galore → STAR alignment → featureCounts → DESeq2.\n\nAll containers are hosted on Docker Hub (mosei/rnaseq-v3). The pipeline is validated on mouse and human tissues.",
    created_by: "user-osei",
    created_at: new Date(Date.now() - 55 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: "wiki-2b",
    project_id: "proj-2",
    parent_id: "wiki-2a",
    title: "Running Instructions",
    content: "1. Clone repo: git clone https://github.com/mosei-eth/rnaseq-pipeline\n2. Edit config/samples.tsv with your sample sheet\n3. Run: snakemake --use-conda --cores 16\n\nMinimum requirements: 32GB RAM, 16 cores, 500GB storage for full run.\n\nFor test run use the provided test dataset in data/test_samples/.",
    created_by: "user-osei",
    created_at: new Date(Date.now() - 50 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
];

const SEED_ISSUES: Issue[] = [
  {
    id: "issue-1a",
    project_id: "proj-1",
    user_id: "user-mehta",
    title: "Signal loss above 200 kDa with standard blocking",
    body: "Even with optimised pH and MeOH, we're still losing signal for very high-MW proteins (>200 kDa). Tested 5% milk and 3% BSA — similar results. Could be the PVDF pore size?",
    status: "open",
    priority: "high",
    labels: ["bug", "high-MW"],
    comments: [
      {
        id: "ic-1a-1",
        issue_id: "issue-1a",
        user_id: "user-park",
        body: "Good catch. Let's try 0.2μm PVDF next — the 0.45μm may not retain very high-MW proteins efficiently during the wash steps.",
        created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
      },
      {
        id: "ic-1a-2",
        issue_id: "issue-1a",
        user_id: "user-sato",
        body: "We had the same issue — switching to nitrocellulose for proteins >150 kDa helped in our lab.",
        created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: "issue-1b",
    project_id: "proj-1",
    user_id: "user-park",
    title: "Add SDS-PAGE gel percentage comparison to protocol",
    body: "We should systematically vary gel % (8%, 10%, 12%) for the same targets to document which gel concentration gives best separation.",
    status: "open",
    priority: "medium",
    labels: ["enhancement", "documentation"],
    comments: [
      {
        id: "ic-1b-1",
        issue_id: "issue-1b",
        user_id: "user-mehta",
        body: "Agreed. I can run the 8% and 10% comparisons next week.",
        created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: "issue-1c",
    project_id: "proj-1",
    user_id: "user-park",
    title: "Update figure panels to include error bars",
    body: "All quantitative figures need proper error bars (SEM, n=3). Currently some panels only show representative blots.",
    status: "solved",
    priority: "low",
    labels: ["documentation"],
    comments: [],
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: "issue-2a",
    project_id: "proj-2",
    user_id: "user-sato",
    title: "STAR index out of date for GRCm39",
    body: "The STAR genome index in the pipeline is built on GRCm38. GRCm39 has been out for over a year — we should update. This affects all mouse samples.",
    status: "open",
    priority: "high",
    labels: ["bug", "reference-genome"],
    comments: [
      {
        id: "ic-2a-1",
        issue_id: "issue-2a",
        user_id: "user-osei",
        body: "On it — will rebuild the index and push updated config by end of week.",
        created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "issue-2b",
    project_id: "proj-2",
    user_id: "user-osei",
    title: "Add support for HISAT2 as alternative aligner",
    body: "Some users prefer HISAT2 over STAR for memory-limited environments. We should add it as an optional aligner in the config.",
    status: "open",
    priority: "medium",
    labels: ["feature", "aligner"],
    comments: [],
    created_at: new Date(Date.now() - 20 * 86400000).toISOString(),
  },
  {
    id: "issue-2c",
    project_id: "proj-2",
    user_id: "user-osei",
    title: "Fix MultiQC report path in Snakemake rule",
    body: "The MultiQC rule outputs to results/qc/multiqc but the summary rule expects it in results/multiqc — causing a missing file error on clean runs.",
    status: "closed",
    priority: "high",
    labels: ["bug"],
    comments: [
      {
        id: "ic-2c-1",
        issue_id: "issue-2c",
        user_id: "user-sato",
        body: "Fixed in commit abc123. Paths now consistent.",
        created_at: new Date(Date.now() - 8 * 86400000).toISOString(),
      },
    ],
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

const SEED_FOLLOWS: Follow[] = [
  { follower_id: MOCK_USER_ID, following_id: "user-park",   created_at: new Date(Date.now() - 50 * 86400000).toISOString() },
  { follower_id: MOCK_USER_ID, following_id: "user-nguyen", created_at: new Date(Date.now() - 30 * 86400000).toISOString() },
  { follower_id: "user-park",  following_id: MOCK_USER_ID,  created_at: new Date(Date.now() - 40 * 86400000).toISOString() },
  { follower_id: "user-nguyen",following_id: MOCK_USER_ID,  created_at: new Date(Date.now() - 25 * 86400000).toISOString() },
  { follower_id: "user-gomez", following_id: MOCK_USER_ID,  created_at: new Date(Date.now() - 15 * 86400000).toISOString() },
];

const SEED_CONVOS: Conversation[] = [
  {
    id: "conv-001", participant_ids: [MOCK_USER_ID, "user-park"],
    last_message: "Thanks for the buffer tip — it worked perfectly!",
    last_message_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: "conv-002", participant_ids: [MOCK_USER_ID, "user-nguyen"],
    last_message: "Would love to collaborate on the organoid scale-up problem.",
    last_message_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
];

const SEED_MESSAGES: Message[] = [
  { id: "msg-001", conversation_id: "conv-001", sender_id: "user-park",
    body: "Hi! I saw your question about the western blot signal loss. Happy to help troubleshoot.", is_read: true,
    created_at: new Date(Date.now() - 6 * 86400000).toISOString() },
  { id: "msg-002", conversation_id: "conv-001", sender_id: MOCK_USER_ID,
    body: "Thank you so much! I've been stuck on this for 3 weeks. The issue is specifically with proteins above 100kDa.", is_read: true,
    created_at: new Date(Date.now() - 5 * 86400000 - 3600000).toISOString() },
  { id: "msg-003", conversation_id: "conv-001", sender_id: "user-park",
    body: "Classic pH issue. Try raising your transfer buffer to pH 8.6 and drop methanol to 15%. Check our method card exp-2041.", is_read: true,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString() },
  { id: "msg-004", conversation_id: "conv-001", sender_id: MOCK_USER_ID,
    body: "Thanks for the buffer tip — it worked perfectly!", is_read: true,
    created_at: new Date(Date.now() - 1 * 86400000).toISOString() },
  { id: "msg-005", conversation_id: "conv-002", sender_id: "user-nguyen",
    body: "I read your Q&A on organoid scale-up. We've hit the same wall. Would love to collaborate on the organoid scale-up problem.", is_read: false,
    created_at: new Date(Date.now() - 3 * 86400000).toISOString() },
];

const SEED_LABS: Lab[] = [
  {
    id: "lab-001", name: "Park Membrane Biology Lab", institution: "Johns Hopkins University",
    pi_user_id: "user-park",
    members: [
      { user_id: "user-park",  role: "pi" },
      { user_id: "user-mehta", role: "postdoc" },
      { user_id: "user-sato",  role: "postdoc" },
    ],
    description: "We study protein trafficking, membrane transport, and lipid-protein interactions. Focus on developing quantitative biochemical assays.",
    research_areas: ["Membrane Biology", "Biochemistry", "Protein Transport"],
    experiment_count: 24, publication_count: 12,
    created_at: new Date(Date.now() - 400 * 86400000).toISOString(),
  },
  {
    id: "lab-002", name: "Nguyen Organoid & Stem Cell Lab", institution: "UCLA",
    pi_user_id: "user-nguyen",
    members: [
      { user_id: "user-nguyen", role: "pi" },
    ],
    description: "Building patient-derived organoid platforms for disease modelling and drug discovery. Open Organoid Consortium founding lab.",
    research_areas: ["Organoid Biology", "Stem Cells", "Drug Discovery"],
    experiment_count: 41, publication_count: 19,
    created_at: new Date(Date.now() - 500 * 86400000).toISOString(),
  },
];

// ─── Profile ──────────────────────────────────────────────────

export function getMockProfile(): Profile {
  const currentId = getCurrentUserId();
  // If this is a seed user (not the registered user), return seed profile
  if (currentId !== MOCK_USER_ID) {
    const seedProfile = SEED_PROFILES.find((p) => p.id === currentId);
    if (seedProfile) return seedProfile;
  }
  const saved = ls<Profile | null>(KEY_PROFILE + "_" + currentId, null)
    ?? ls<Profile | null>(KEY_PROFILE, null);
  if (saved && typeof saved === "object") {
    // Backfill fields added after initial release
    const p = saved as Profile;
    const backfill: Partial<Profile> = {};
    if (!("google_scholar_id"   in p) || p.google_scholar_id   === undefined) backfill.google_scholar_id   = null;
    if (!("semantic_scholar_id" in p) || p.semantic_scholar_id === undefined) backfill.semantic_scholar_id = null;
    if (!("orcid_verified"      in p) || p.orcid_verified      === undefined) backfill.orcid_verified      = false;
    return Object.keys(backfill).length ? { ...p, ...backfill } : p;
  }
  // Build default profile from StoredUser if available
  const storedUsers = ls<StoredUser[]>(KEY_USERS, []);
  const storedUser = storedUsers.find((u) => u.id === currentId);
  return {
    id: currentId, full_name: storedUser?.name ?? "Researcher", institution: "",
    orcid_id: null, google_scholar_id: null, semantic_scholar_id: null,
    role: "", research_domain: "", techniques: [],
    bio: null,
    avatar_initials: storedUser?.avatar_initials ?? "R",
    avatar_color: storedUser?.avatar_color ?? "bg-slate-600",
    h_index: 0, citation_count: 0, publication_count: 0,
    followers_count: 0, following_count: 0,
    skills: [], grants: [], social_links: {},
    is_verified: false, orcid_verified: false, profile_completeness: 20,
    joined_at: new Date().toISOString(),
  };
}

export function calcProfileCompleteness(p: Profile): number {
  const checks = [
    !!p.full_name && p.full_name !== "Researcher",
    !!p.institution,
    !!p.bio,
    !!p.orcid_id,
    (p.techniques?.length ?? 0) > 0,
    (p.skills?.length ?? 0) > 0,
    !!p.research_domain,
    !!(p.social_links?.twitter || p.social_links?.github || p.social_links?.website || p.social_links?.linkedin),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function saveMockProfile(p: Partial<Profile>) {
  const currentId = getCurrentUserId();
  const current = getMockProfile();
  const updated = { ...current, ...p, id: currentId };
  // auto-compute initials + completeness
  if (p.full_name) {
    const parts = p.full_name.trim().split(" ");
    updated.avatar_initials = parts.length > 1
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : p.full_name[0].toUpperCase();
  }
  const fields = [updated.full_name, updated.institution, updated.role, updated.research_domain, updated.bio, updated.orcid_id];
  updated.profile_completeness = Math.round((fields.filter(Boolean).length / fields.length) * 100);
  lsSet(KEY_PROFILE + "_" + currentId, updated);
  // Legacy key for backward compatibility
  if (currentId === MOCK_USER_ID) lsSet(KEY_PROFILE, updated);
}

export function getProfile(userId: string): Profile | null {
  const currentId = getCurrentUserId();
  if (userId === currentId || userId === MOCK_USER_ID) return getMockProfile();
  // Check saved profiles for registered users
  const saved = ls<Profile | null>(KEY_PROFILE + "_" + userId, null);
  if (saved) return saved;
  return SEED_PROFILES.find((p) => p.id === userId) ?? null;
}

export function getAllProfiles(): Profile[] {
  return [getMockProfile(), ...SEED_PROFILES];
}

// ─── Experiments ──────────────────────────────────────────────

export function getAllExperiments(): Experiment[] {
  return [...ls<Experiment[]>(KEY_EXPERIMENTS, []), ...SEED_EXPERIMENTS];
}

export function getMyExperiments(): Experiment[] {
  return ls<Experiment[]>(KEY_EXPERIMENTS, []);
}

export function getExperiment(id: string): Experiment | null {
  const local = ls<Experiment[]>(KEY_EXPERIMENTS, []);
  return local.find((e) => e.id === id) ?? SEED_EXPERIMENTS.find((e) => e.id === id) ?? null;
}

export function saveExperiment(data: Omit<Experiment, "id" | "created_at">): Experiment {
  const newExp: Experiment = { ...data, id: `exp-${uid()}`, created_at: new Date().toISOString() };
  lsSet(KEY_EXPERIMENTS, [newExp, ...ls<Experiment[]>(KEY_EXPERIMENTS, [])]);
  return newExp;
}

export function updateExperiment(id: string, patch: Partial<Omit<Experiment, "id" | "created_at">>): Experiment | null {
  const local = ls<Experiment[]>(KEY_EXPERIMENTS, []);
  const idx = local.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  const updated = { ...local[idx], ...patch };
  local[idx] = updated;
  lsSet(KEY_EXPERIMENTS, local);
  return updated;
}

export function forkExperiment(source: Experiment): Experiment {
  const currentId = getCurrentUserId();
  const originalId = source.id;
  const originalOwnerId = source.user_id;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, created_at: _ca, ...rest } = source;
  const forked = saveExperiment({
    ...rest,
    parent_id: originalId,
    user_id: currentId,
    title: `${source.title} (fork)`,
    outcome: null, outcome_summary: null, failure_context: null, root_cause: null,
    attached_files: [], visibility: "lab", co_authors: [],
  });
  // Notify the original owner
  if (originalOwnerId !== currentId) {
    const forkerProfile = getMockProfile();
    createNotification(originalOwnerId, {
      type: "fork",
      title: "Your protocol was forked",
      body: `${forkerProfile.full_name} forked your experiment "${source.title}".`,
      linked_type: "experiment",
      linked_id: originalId,
      user_id: originalOwnerId,
    });
  }
  return forked;
}

export function getForks(parentId: string): Experiment[] {
  return getAllExperiments().filter((e) => e.parent_id === parentId);
}

export function searchExperiments(query: string): Array<Experiment & { matchPct: number }> {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  const terms = q.split(/\s+/).filter(Boolean);
  const currentId = getCurrentUserId();
  const all = getAllExperiments().filter((e) => e.visibility === "public" || e.user_id === currentId);
  function score(e: Experiment): number {
    let s = 0;
    for (const t of terms) {
      if (e.title?.toLowerCase().includes(t)) s += 50;
      if (e.technique_tags?.some((x) => x.toLowerCase().includes(t))) s += 30;
      if (e.organism_tags?.some((x) => x.toLowerCase().includes(t))) s += 25;
      if (e.conditions?.toLowerCase().includes(t)) s += 15;
      if (e.outcome_summary?.toLowerCase().includes(t)) s += 10;
      if (e.methods?.toLowerCase().includes(t)) s += 5;
    }
    return Math.min(99, Math.round(s / terms.length));
  }
  return all.map((e) => ({ ...e, matchPct: score(e) })).filter((e) => e.matchPct > 0).sort((a, b) => b.matchPct - a.matchPct);
}

// ─── Experiment Q&A ──────────────────────────────────────────

export function getQuestions(experimentId: string): Question[] {
  const local = ls<Question[]>(KEY_QUESTIONS, []).filter((q) => q.experiment_id === experimentId);
  const localIds = new Set(local.map((q) => q.id));
  const seed  = SEED_QUESTIONS.filter((q) => q.experiment_id === experimentId && !localIds.has(q.id));
  return [...local, ...seed];
}

export function saveQuestion(experimentId: string, body: string): Question {
  const q: Question = { id: `q-${uid()}`, experiment_id: experimentId, user_id: getCurrentUserId(), body, created_at: new Date().toISOString(), answers: [] };
  lsSet(KEY_QUESTIONS, [q, ...ls<Question[]>(KEY_QUESTIONS, [])]);
  return q;
}

export function saveAnswer(questionId: string, body: string): Answer {
  const a: Answer = { id: `a-${uid()}`, question_id: questionId, user_id: getCurrentUserId(), body, is_endorsed: false, created_at: new Date().toISOString() };
  const all = ls<Question[]>(KEY_QUESTIONS, []);
  lsSet(KEY_QUESTIONS, all.map((q) => q.id === questionId ? { ...q, answers: [...q.answers, a] } : q));
  return a;
}

export function endorseAnswer(questionId: string, answerId: string) {
  const all = ls<Question[]>(KEY_QUESTIONS, []);
  lsSet(KEY_QUESTIONS, all.map((q) => q.id === questionId
    ? { ...q, answers: q.answers.map((a) => a.id === answerId ? { ...a, is_endorsed: true } : a) } : q));
}

export function getMockProfile_compat() { return getMockProfile(); }

// ─── Publications ─────────────────────────────────────────────

export function getAllPublications(): Publication[] {
  return [...ls<Publication[]>(KEY_PUBLICATIONS, []), ...SEED_PUBLICATIONS];
}

export function getPublication(id: string): Publication | null {
  const local = ls<Publication[]>(KEY_PUBLICATIONS, []);
  return local.find((p) => p.id === id) ?? SEED_PUBLICATIONS.find((p) => p.id === id) ?? null;
}

export function getUserPublications(userId: string): Publication[] {
  return getAllPublications().filter((p) => p.user_id === userId);
}

export function savePublication(data: Omit<Publication, "id" | "created_at" | "like_count" | "liked_by" | "read_count" | "citation_count">): Publication {
  const pub: Publication = { ...data, id: `pub-${uid()}`, created_at: new Date().toISOString(), like_count: 0, liked_by: [], read_count: 0, citation_count: 0 };
  lsSet(KEY_PUBLICATIONS, [pub, ...ls<Publication[]>(KEY_PUBLICATIONS, [])]);
  return pub;
}

export function toggleLikePublication(pubId: string): Publication | null {
  const currentId = getCurrentUserId();
  const all = [...ls<Publication[]>(KEY_PUBLICATIONS, []), ...SEED_PUBLICATIONS];
  const pub = all.find((p) => p.id === pubId);
  if (!pub) return null;
  const hasLiked = pub.liked_by.includes(currentId);
  const updated = { ...pub, liked_by: hasLiked ? pub.liked_by.filter((id) => id !== currentId) : [...pub.liked_by, currentId], like_count: hasLiked ? pub.like_count - 1 : pub.like_count + 1 };
  const local = ls<Publication[]>(KEY_PUBLICATIONS, []);
  const localIdx = local.findIndex((p) => p.id === pubId);
  if (localIdx >= 0) { local[localIdx] = updated; lsSet(KEY_PUBLICATIONS, local); }
  else { lsSet(KEY_PUBLICATIONS, [updated, ...local]); }
  return updated;
}

export function searchPublications(query: string): Publication[] {
  const q = query.toLowerCase();
  return getAllPublications().filter((p) =>
    p.title.toLowerCase().includes(q) ||
    p.abstract?.toLowerCase().includes(q) ||
    p.authors.some((a) => a.toLowerCase().includes(q)) ||
    p.tags.some((t) => t.toLowerCase().includes(q))
  );
}

// ─── Feed ─────────────────────────────────────────────────────

export function getFeed(): FeedPost[] {
  const local = ls<FeedPost[]>(KEY_FEED, []);
  const localIds = new Set(local.map((p) => p.id));
  const seeds = SEED_FEED.filter((p) => !localIds.has(p.id));
  return [...local, ...seeds].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function saveFeedPost(data: Omit<FeedPost, "id" | "created_at" | "like_count" | "comment_count" | "repost_count" | "liked_by" | "bookmarked_by">): FeedPost {
  const post: FeedPost = { ...data, id: `feed-${uid()}`, created_at: new Date().toISOString(), like_count: 0, comment_count: 0, repost_count: 0, liked_by: [], bookmarked_by: [] };
  lsSet(KEY_FEED, [post, ...ls<FeedPost[]>(KEY_FEED, [])]);
  return post;
}

export function updateFeedPost(postId: string, content: string): FeedPost | null {
  const currentId = getCurrentUserId();
  const all = getFeed();
  const post = all.find((p) => p.id === postId);
  if (!post || post.user_id !== currentId) return null;
  const updated = { ...post, content };
  const local = ls<FeedPost[]>(KEY_FEED, []);
  const idx = local.findIndex((p) => p.id === postId);
  if (idx >= 0) { local[idx] = updated; lsSet(KEY_FEED, local); }
  else { lsSet(KEY_FEED, [updated, ...local]); }
  return updated;
}

export function deleteFeedPost(postId: string): boolean {
  const local = ls<FeedPost[]>(KEY_FEED, []);
  const next = local.filter((p) => p.id !== postId);
  if (next.length === local.length) return false; // seed post — can't delete
  lsSet(KEY_FEED, next);
  return true;
}

export function toggleLikeFeedPost(postId: string): FeedPost | null {
  const currentId = getCurrentUserId();
  const all = getFeed();
  const post = all.find((p) => p.id === postId);
  if (!post) return null;
  const hasLiked = post.liked_by.includes(currentId);
  const updated = { ...post, liked_by: hasLiked ? post.liked_by.filter((id) => id !== currentId) : [...post.liked_by, currentId], like_count: hasLiked ? post.like_count - 1 : post.like_count + 1 };
  const local = ls<FeedPost[]>(KEY_FEED, []);
  const idx = local.findIndex((p) => p.id === postId);
  if (idx >= 0) { local[idx] = updated; lsSet(KEY_FEED, local); }
  else { lsSet(KEY_FEED, [updated, ...local]); }
  return updated;
}

export function repostFeedPost(postId: string): FeedPost | null {
  const all = getFeed();
  const original = all.find((p) => p.id === postId);
  if (!original) return null;

  // Increment repost_count on original
  const updatedOriginal = { ...original, repost_count: original.repost_count + 1 };
  const local = ls<FeedPost[]>(KEY_FEED, []);
  const idx = local.findIndex((p) => p.id === postId);
  if (idx >= 0) { local[idx] = updatedOriginal; lsSet(KEY_FEED, local); }

  // Create new repost entry
  const author = getProfile(original.user_id);
  const repost = saveFeedPost({
    user_id: getCurrentUserId(),
    type: original.type,
    content: `🔁 Reposted from ${author?.full_name ?? "Researcher"}:\n\n${original.content}`,
    linked_experiment_id: original.linked_experiment_id,
    linked_publication_id: original.linked_publication_id,
    linked_question_id: original.linked_question_id,
  });
  return repost;
}

export function incrementFeedCommentCount(postId: string): void {
  const local = ls<FeedPost[]>(KEY_FEED, []);
  const idx = local.findIndex((p) => p.id === postId);
  if (idx >= 0) { local[idx] = { ...local[idx], comment_count: local[idx].comment_count + 1 }; lsSet(KEY_FEED, local); }
}

export function decrementFeedCommentCount(postId: string): void {
  const local = ls<FeedPost[]>(KEY_FEED, []);
  const idx = local.findIndex((p) => p.id === postId);
  if (idx >= 0) { local[idx] = { ...local[idx], comment_count: Math.max(0, local[idx].comment_count - 1) }; lsSet(KEY_FEED, local); }
}

export function toggleBookmarkFeedPost(postId: string): FeedPost | null {
  const currentId = getCurrentUserId();
  const all = getFeed();
  const post = all.find((p) => p.id === postId);
  if (!post) return null;
  const hasBookmarked = post.bookmarked_by.includes(currentId);
  const updated = { ...post, bookmarked_by: hasBookmarked ? post.bookmarked_by.filter((id) => id !== currentId) : [...post.bookmarked_by, currentId] };
  const local = ls<FeedPost[]>(KEY_FEED, []);
  const idx = local.findIndex((p) => p.id === postId);
  if (idx >= 0) { local[idx] = updated; lsSet(KEY_FEED, local); }
  else { lsSet(KEY_FEED, [updated, ...local]); }
  return updated;
}

export function getBookmarkedPosts(): FeedPost[] {
  const currentId = getCurrentUserId();
  return getFeed().filter((p) => p.bookmarked_by.includes(currentId));
}

// ─── Follows ──────────────────────────────────────────────────

export function getFollows(): Follow[] {
  return [...ls<Follow[]>(KEY_FOLLOWS, []), ...SEED_FOLLOWS];
}

export function isFollowing(targetId: string): boolean {
  const currentId = getCurrentUserId();
  return getFollows().some((f) => f.follower_id === currentId && f.following_id === targetId);
}

export function followUser(targetId: string): void {
  const currentId = getCurrentUserId();
  const local = ls<Follow[]>(KEY_FOLLOWS, []);
  const existing = local.find((f) => f.follower_id === currentId && f.following_id === targetId);
  if (existing) return;
  lsSet(KEY_FOLLOWS, [...local, { follower_id: currentId, following_id: targetId, created_at: new Date().toISOString() }]);
  const followerProfile = getMockProfile();
  createNotification(targetId, {
    type: "follow",
    title: "New follower",
    body: `${followerProfile.full_name} started following you.`,
    linked_type: "profile",
    linked_id: currentId,
    user_id: targetId,
  });
}

export function toggleFollow(targetId: string): boolean {
  const currentId = getCurrentUserId();
  const local = ls<Follow[]>(KEY_FOLLOWS, []);
  const existing = local.findIndex((f) => f.follower_id === currentId && f.following_id === targetId);
  if (existing >= 0) { local.splice(existing, 1); lsSet(KEY_FOLLOWS, local); return false; }
  lsSet(KEY_FOLLOWS, [...local, { follower_id: currentId, following_id: targetId, created_at: new Date().toISOString() }]);
  // Notify on follow
  const followerProfile = getMockProfile();
  createNotification(targetId, {
    type: "follow",
    title: "New follower",
    body: `${followerProfile.full_name} started following you.`,
    linked_type: "profile",
    linked_id: currentId,
    user_id: targetId,
  });
  return true;
}

export function getFollowing(): string[] {
  const currentId = getCurrentUserId();
  return getFollows().filter((f) => f.follower_id === currentId).map((f) => f.following_id);
}

export function getFollowers(): string[] {
  const currentId = getCurrentUserId();
  return getFollows().filter((f) => f.following_id === currentId).map((f) => f.follower_id);
}

// ─── Notifications ────────────────────────────────────────────

export function createNotification(
  forUserId: string,
  notif: Omit<Notification, "id" | "created_at" | "is_read">
): void {
  const key = `scicollab_notifications_${forUserId}`;
  const existing = ls<Notification[]>(key, []);
  const newNotif: Notification = {
    ...notif,
    id: `notif-${uid()}`,
    created_at: new Date().toISOString(),
    is_read: false,
  };
  lsSet(key, [newNotif, ...existing]);
}

export function getNotifications(): Notification[] {
  const local = ls<Notification[]>(KEY_NOTIFICATIONS, []);
  const localIds = new Set(local.map((n) => n.id));
  const seeds = SEED_NOTIFICATIONS.filter((n) => !localIds.has(n.id));
  return [...local, ...seeds].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function getUnreadCount(): number {
  return getNotifications().filter((n) => !n.is_read).length;
}

export function markNotificationRead(id: string) {
  const local = ls<Notification[]>(KEY_NOTIFICATIONS, []);
  lsSet(KEY_NOTIFICATIONS, local.map((n) => n.id === id ? { ...n, is_read: true } : n));
  // also patch seed (via override list)
  const overrides = ls<Record<string, boolean>>("scicollab_notif_read", {});
  overrides[id] = true;
  lsSet("scicollab_notif_read", overrides);
}

export function markAllNotificationsRead() {
  const local = ls<Notification[]>(KEY_NOTIFICATIONS, []);
  lsSet(KEY_NOTIFICATIONS, local.map((n) => ({ ...n, is_read: true })));
  const overrides: Record<string, boolean> = {};
  SEED_NOTIFICATIONS.forEach((n) => { overrides[n.id] = true; });
  lsSet("scicollab_notif_read", overrides);
}

export function getNotificationsWithReadState(): Notification[] {
  const currentId = getCurrentUserId();
  const overrides = ls<Record<string, boolean>>("scicollab_notif_read", {});
  // User-specific notifications created by actions
  const userSpecific = ls<Notification[]>(`scicollab_notifications_${currentId}`, []);
  const local = ls<Notification[]>(KEY_NOTIFICATIONS, []);
  const userSpecificIds = new Set(userSpecific.map((n) => n.id));
  const localIds = new Set([...userSpecific, ...local].map((n) => n.id));
  // Seed notifications only for mock-user (they're community seed data)
  const seeds = currentId === MOCK_USER_ID
    ? SEED_NOTIFICATIONS.filter((n) => !localIds.has(n.id)).map((n) => ({ ...n, is_read: overrides[n.id] ?? n.is_read }))
    : [];
  // For non-mock users, include seed notifications that aren't user-specific
  const legacyLocal = local.filter((n) => !userSpecificIds.has(n.id));
  const all = [...userSpecific, ...legacyLocal, ...seeds];
  return all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ─── Standalone Q&A ───────────────────────────────────────────

export function getStandaloneQuestions(): StandaloneQuestion[] {
  return [...ls<StandaloneQuestion[]>(KEY_SQ, []), ...SEED_STANDALONE_QUESTIONS].sort((a, b) => b.vote_count - a.vote_count);
}

export function getStandaloneQuestion(id: string): StandaloneQuestion | null {
  const local = ls<StandaloneQuestion[]>(KEY_SQ, []);
  return local.find((q) => q.id === id) ?? SEED_STANDALONE_QUESTIONS.find((q) => q.id === id) ?? null;
}

export function saveStandaloneQuestion(title: string, body: string, tags: string[]): StandaloneQuestion {
  const q: StandaloneQuestion = { id: `sq-${uid()}`, user_id: getCurrentUserId(), title, body, tags, vote_count: 0, view_count: 0, is_answered: false, accepted_answer_id: null, answers: [], created_at: new Date().toISOString() };
  lsSet(KEY_SQ, [q, ...ls<StandaloneQuestion[]>(KEY_SQ, [])]);
  return q;
}

export function saveStandaloneAnswer(questionId: string, body: string): StandaloneAnswer {
  const a: StandaloneAnswer = { id: `sqa-${uid()}`, question_id: questionId, user_id: getCurrentUserId(), body, vote_count: 0, is_accepted: false, created_at: new Date().toISOString() };
  const local = ls<StandaloneQuestion[]>(KEY_SQ, []);
  lsSet(KEY_SQ, local.map((q) => q.id === questionId ? { ...q, answers: [...q.answers, a] } : q));
  return a;
}

export function voteStandaloneQuestion(id: string, delta: 1 | -1) {
  const local = ls<StandaloneQuestion[]>(KEY_SQ, []);
  lsSet(KEY_SQ, local.map((q) => q.id === id ? { ...q, vote_count: q.vote_count + delta } : q));
}

// ─── Messages ─────────────────────────────────────────────────

export function getConversations(): Conversation[] {
  const local = ls<Conversation[]>(KEY_CONVOS, []);
  const localIds = new Set(local.map((c) => c.id));
  return [...local, ...SEED_CONVOS.filter((c) => !localIds.has(c.id))];
}

export function getMessages(conversationId: string): Message[] {
  const local = ls<Message[]>(KEY_MESSAGES, []);
  const localIds = new Set(local.map((m) => m.id));
  const seed  = SEED_MESSAGES.filter((m) => !localIds.has(m.id));
  return [...local, ...seed].filter((m) => m.conversation_id === conversationId).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function sendMessage(conversationId: string, body: string): Message {
  const m: Message = { id: `msg-${uid()}`, conversation_id: conversationId, sender_id: getCurrentUserId(), body, is_read: false, created_at: new Date().toISOString() };
  lsSet(KEY_MESSAGES, [...ls<Message[]>(KEY_MESSAGES, []), m]);
  const convos = ls<Conversation[]>(KEY_CONVOS, []);
  lsSet(KEY_CONVOS, convos.map((c) => c.id === conversationId ? { ...c, last_message: body, last_message_at: m.created_at } : c));
  return m;
}

export function startConversation(otherUserId: string): Conversation {
  const currentId = getCurrentUserId();
  const existing = getConversations().find((c) => c.participant_ids.includes(otherUserId) && c.participant_ids.includes(currentId));
  if (existing) return existing;
  const conv: Conversation = { id: `conv-${uid()}`, participant_ids: [currentId, otherUserId], last_message: null, last_message_at: null, created_at: new Date().toISOString() };
  lsSet(KEY_CONVOS, [conv, ...ls<Conversation[]>(KEY_CONVOS, [])]);
  return conv;
}

// ─── Labs ─────────────────────────────────────────────────────

export function getLabs(): Lab[] { return SEED_LABS; }

export function getMyLab(): Lab | null {
  const currentId = getCurrentUserId();
  return SEED_LABS.find((l) => l.pi_user_id === currentId || l.members.some((m) => m.user_id === currentId)) ?? null;
}

export function deletePublication(id: string): void {
  const local = ls<Publication[]>(KEY_PUBLICATIONS, []);
  lsSet(KEY_PUBLICATIONS, local.filter((p) => p.id !== id));
}

// ─── Comments ─────────────────────────────────────────────────

export function getComments(targetType: "experiment" | "publication" | "feedpost" | "project", targetId: string): Comment[] {
  return ls<Comment[]>(KEY_COMMENTS, [])
    .filter((c) => c.target_type === targetType && c.target_id === targetId)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
}

export function addComment(data: Omit<Comment, "id" | "created_at"> & { target_type: "experiment" | "publication" | "feedpost" | "project" }): Comment {
  const comment: Comment = { ...data, id: `cmt-${uid()}`, created_at: new Date().toISOString() };
  lsSet(KEY_COMMENTS, [...ls<Comment[]>(KEY_COMMENTS, []), comment]);
  return comment;
}

export function deleteComment(id: string): void {
  const currentId = getCurrentUserId();
  const all = ls<Comment[]>(KEY_COMMENTS, []);
  lsSet(KEY_COMMENTS, all.filter((c) => !(c.id === id && c.user_id === currentId)));
}

// ─── Privacy Settings ─────────────────────────────────────────

const DEFAULT_PRIVACY: PrivacySettings = {
  profile_visibility: "public",
  email_visible: false,
  show_experiments: true,
  show_publications: true,
  allow_messages: "all",
  indexed_by_search: true,
};

export function getPrivacySettings(): PrivacySettings {
  return ls<PrivacySettings>(KEY_PRIVACY, DEFAULT_PRIVACY);
}

export function updatePrivacySettings(s: Partial<PrivacySettings>): PrivacySettings {
  const current = getPrivacySettings();
  const updated = { ...current, ...s };
  lsSet(KEY_PRIVACY, updated);
  return updated;
}

// ─── People Search ────────────────────────────────────────────

export function searchProfiles(query: string): Profile[] {
  const q = query.toLowerCase().trim();
  const all = [...SEED_PROFILES, getMockProfile()];
  if (!q) return all;
  return all.filter((p) =>
    p.full_name.toLowerCase().includes(q) ||
    p.institution.toLowerCase().includes(q) ||
    p.research_domain.toLowerCase().includes(q) ||
    p.techniques.some((t) => t.toLowerCase().includes(q)) ||
    p.skills.some((s) => s.toLowerCase().includes(q))
  );
}

// ─── Reports ─────────────────────────────────────────────────

export function addReport(data: Omit<Report, "id" | "created_at" | "status">): Report {
  const report: Report = { ...data, id: `rpt-${uid()}`, created_at: new Date().toISOString(), status: "pending" };
  lsSet(KEY_REPORTS, [...ls<Report[]>(KEY_REPORTS, []), report]);
  return report;
}

export function getReports(): Report[] {
  return ls<Report[]>(KEY_REPORTS, []).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function updateReportStatus(id: string, status: Report["status"]): void {
  const all = ls<Report[]>(KEY_REPORTS, []);
  lsSet(KEY_REPORTS, all.map((r) => r.id === id ? { ...r, status } : r));
}

export function hasReported(targetId: string): boolean {
  const currentId = getCurrentUserId();
  return ls<Report[]>(KEY_REPORTS, []).some((r) => r.reporter_id === currentId && r.target_id === targetId);
}

// ─── ORCID ────────────────────────────────────────────────────

export function updateOrcidId(orcid: string): void {
  saveMockProfile({ orcid_id: orcid });
}

// ─── Google Scholar ───────────────────────────────────────────

export function updateGoogleScholarId(scholarId: string): void {
  saveMockProfile({ google_scholar_id: scholarId });
}

// ─── Semantic Scholar / OpenAlex — live sync helpers ─────────

export function updateSemanticScholarId(ssId: string): void {
  saveMockProfile({ semantic_scholar_id: ssId });
}

/** Merge live stats from Semantic Scholar / OpenAlex into the mock profile. */
export function updateProfileStats(patch: {
  h_index?: number;
  citation_count?: number;
  publication_count?: number;
  semantic_scholar_id?: string;
}): void {
  saveMockProfile(patch);
}

/** Import publications fetched from an external API into localStorage.
 *  Skips duplicates (matched by DOI or arXiv ID or title). */
export function importPublicationsFromData(
  items: Array<{
    title: string;
    authors: string[];
    year: number;
    journal: string | null;
    doi: string | null;
    arxiv_id: string | null;
    abstract: string | null;
    citation_count: number;
    tags: string[];
  }>
): { added: number; skipped: number } {
  const existing = getAllPublications();
  const me = getMockProfile();
  let added = 0; let skipped = 0;

  for (const item of items) {
    // Dedup: DOI match, arXiv match, or title match
    const isDup = existing.some(
      (p) =>
        (item.doi && p.doi && p.doi.toLowerCase() === item.doi.toLowerCase()) ||
        (item.arxiv_id && p.arxiv_id && p.arxiv_id === item.arxiv_id) ||
        p.title.toLowerCase() === item.title.toLowerCase()
    );
    if (isDup) { skipped++; continue; }

    savePublication({
      user_id: me.id,
      title: item.title,
      abstract: item.abstract,
      authors: item.authors,
      journal: item.journal,
      year: item.year,
      doi: item.doi,
      arxiv_id: item.arxiv_id,
      type: "paper",
      tags: item.tags,
      status: "published",
    });
    // patch the saved pub's citation_count directly
    if (item.citation_count > 0) {
      const pubs = getAllPublications();
      const saved = pubs[pubs.length - 1];
      if (saved) {
        const patched = pubs.map((p) =>
          p.id === saved.id ? { ...p, citation_count: item.citation_count } : p
        );
        lsSet(KEY_PUBLICATIONS, patched);
      }
    }
    added++;
  }
  return { added, skipped };
}

// ─── Projects ─────────────────────────────────────────────────

export function getProjects(): Project[] {
  const local = ls<Project[]>(KEY_PROJECTS, []);
  const localIds = new Set(local.map((p) => p.id));
  return [...local, ...SEED_PROJECTS.filter((p) => !localIds.has(p.id))];
}

export function getProject(id: string): Project | null {
  return getProjects().find((p) => p.id === id) ?? null;
}

export function getUserProjects(userId: string): Project[] {
  return getProjects().filter((p) => p.user_id === userId || p.collaborator_ids.includes(userId));
}

export function addProjectContributor(projectId: string, userId: string): Project | null {
  const p = getProject(projectId);
  if (!p || p.collaborator_ids.includes(userId)) return p ?? null;
  return updateProject(projectId, { collaborator_ids: [...p.collaborator_ids, userId] });
}

export function removeProjectContributor(projectId: string, userId: string): Project | null {
  const p = getProject(projectId);
  if (!p) return null;
  return updateProject(projectId, { collaborator_ids: p.collaborator_ids.filter((id) => id !== userId) });
}

export function saveProject(data: Omit<Project, "id" | "created_at" | "updated_at">): Project {
  const now = new Date().toISOString();
  const proj: Project = { ...data, id: `proj-${uid()}`, created_at: now, updated_at: now };
  lsSet(KEY_PROJECTS, [proj, ...ls<Project[]>(KEY_PROJECTS, [])]);
  return proj;
}

export function updateProject(id: string, patch: Partial<Omit<Project, "id" | "created_at">>): Project | null {
  const all = getProjects();
  const proj = all.find((p) => p.id === id);
  if (!proj) return null;
  const updated = { ...proj, ...patch, updated_at: new Date().toISOString() };
  const local = ls<Project[]>(KEY_PROJECTS, []);
  const idx = local.findIndex((p) => p.id === id);
  if (idx >= 0) { local[idx] = updated; lsSet(KEY_PROJECTS, local); }
  else { lsSet(KEY_PROJECTS, [updated, ...local]); }
  return updated;
}

export function deleteProject(id: string): void {
  const local = ls<Project[]>(KEY_PROJECTS, []);
  lsSet(KEY_PROJECTS, local.filter((p) => p.id !== id));
}

// ─── Wiki ─────────────────────────────────────────────────────

export function getWikiPages(projectId: string): WikiPage[] {
  const local = ls<WikiPage[]>(KEY_WIKI, []).filter((w) => w.project_id === projectId);
  const localIds = new Set(local.map((w) => w.id));
  const seed = SEED_WIKI.filter((w) => w.project_id === projectId && !localIds.has(w.id));
  return [...local, ...seed].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export function saveWikiPage(data: Omit<WikiPage, "id" | "created_at" | "updated_at">): WikiPage {
  const now = new Date().toISOString();
  const page: WikiPage = { ...data, id: `wiki-${uid()}`, created_at: now, updated_at: now };
  lsSet(KEY_WIKI, [page, ...ls<WikiPage[]>(KEY_WIKI, [])]);
  return page;
}

export function updateWikiPage(id: string, content: string, title: string, parent_id?: string | null): WikiPage | null {
  const all = ls<WikiPage[]>(KEY_WIKI, []);
  const idx = all.findIndex((w) => w.id === id);
  const patch: Partial<WikiPage> = { content, title, updated_at: new Date().toISOString() };
  if (parent_id !== undefined) patch.parent_id = parent_id;
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
    lsSet(KEY_WIKI, all);
    return all[idx];
  }
  // If it's a seed page, copy to local storage
  const seed = SEED_WIKI.find((w) => w.id === id);
  if (seed) {
    const updated = { ...seed, ...patch };
    lsSet(KEY_WIKI, [updated, ...all]);
    return updated;
  }
  return null;
}

export function deleteWikiPage(id: string): void {
  const local = ls<WikiPage[]>(KEY_WIKI, []);
  lsSet(KEY_WIKI, local.filter((w) => w.id !== id));
}

// ─── Issues ───────────────────────────────────────────────────

export function getIssues(projectId: string): Issue[] {
  const local = ls<Issue[]>(KEY_ISSUES, []).filter((i) => i.project_id === projectId);
  const localIds = new Set(local.map((i) => i.id));
  const seed = SEED_ISSUES.filter((i) => i.project_id === projectId && !localIds.has(i.id));
  return [...local, ...seed].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export function saveIssue(data: Omit<Issue, "id" | "created_at" | "comments">): Issue {
  const issue: Issue = { ...data, id: `issue-${uid()}`, comments: [], created_at: new Date().toISOString() };
  lsSet(KEY_ISSUES, [issue, ...ls<Issue[]>(KEY_ISSUES, [])]);
  return issue;
}

function patchIssue(id: string, patch: Partial<Issue>): void {
  const all = ls<Issue[]>(KEY_ISSUES, []);
  const idx = all.findIndex((i) => i.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
    lsSet(KEY_ISSUES, all);
    return;
  }
  // Copy seed issue to local if not found in local
  const seed = SEED_ISSUES.find((i) => i.id === id);
  if (seed) lsSet(KEY_ISSUES, [{ ...seed, ...patch }, ...all]);
}

export function updateIssueStatus(id: string, status: Issue["status"]): void {
  patchIssue(id, { status });
}

export function deleteIssue(id: string): void {
  lsSet(KEY_ISSUES, ls<Issue[]>(KEY_ISSUES, []).filter((i) => i.id !== id));
}

export function updateIssuePriority(id: string, priority: Issue["priority"]): void {
  patchIssue(id, { priority });
}

export function addIssueComment(issueId: string, body: string): IssueComment {
  const comment: IssueComment = {
    id: `ic-${uid()}`,
    issue_id: issueId,
    user_id: getCurrentUserId(),
    body,
    created_at: new Date().toISOString(),
  };
  const all = ls<Issue[]>(KEY_ISSUES, []);
  const idx = all.findIndex((i) => i.id === issueId);
  if (idx >= 0) {
    all[idx] = { ...all[idx], comments: [...all[idx].comments, comment] };
    lsSet(KEY_ISSUES, all);
  } else {
    // Copy seed issue to local with the new comment
    const seed = SEED_ISSUES.find((i) => i.id === issueId);
    if (seed) lsSet(KEY_ISSUES, [{ ...seed, comments: [...seed.comments, comment] }, ...all]);
  }
  return comment;
}

// ─── View Counters ────────────────────────────────────────────

export function incrementExperimentView(id: string): void {
  const key = `scicollab_views_${id}`;
  const current = ls<number>(key, 0);
  lsSet(key, current + 1);
}

export function getExperimentViews(id: string): number {
  const key = `scicollab_views_${id}`;
  const stored = ls<number>(key, -1);
  if (stored >= 0) return stored;
  // Base value from experiment data
  const exp = getExperiment(id);
  return exp ? Math.round(simpleHashFn(id) % 500 + 50) : 0;
}

function simpleHashFn(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

// ─── Waitlist ─────────────────────────────────────────────────

export function addToWaitlist(email: string): boolean {
  const key = "scicollab_waitlist";
  const list = ls<{ email: string; timestamp: string }[]>(key, []);
  if (list.some((e) => e.email.toLowerCase() === email.toLowerCase())) return false;
  lsSet(key, [...list, { email, timestamp: new Date().toISOString() }]);
  return true;
}

// ─── Analytics ────────────────────────────────────────────────

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function getAuthorAnalytics(userId: string): AuthorAnalytics {
  const seed = simpleHash(userId);
  const rand = seededRandom(seed);

  function makeSeries(base: number): AnalyticsSeries {
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return {
        date: d.toISOString().slice(0, 10),
        value: Math.max(0, Math.round(base * (0.5 + rand()) + rand() * base * 0.3)),
      };
    });
  }

  const userExps = getAllExperiments().filter((e) => e.user_id === userId);
  const userPubs = getAllPublications().filter((p) => p.user_id === userId);

  return {
    profile_views: makeSeries(40 + Math.round(rand() * 60)),
    experiment_views: makeSeries(20 + Math.round(rand() * 40)),
    publication_views: makeSeries(30 + Math.round(rand() * 80)),
    total_forks: Math.round(rand() * 15),
    total_citations: userPubs.reduce((s, p) => s + p.citation_count, 0),
    total_followers_gained: Math.round(rand() * 25 + 3),
    top_experiments: userExps.slice(0, 3).map((e) => ({
      id: e.id,
      title: e.title,
      views: getExperimentViews(e.id),
      forks: Math.round(rand() * 10),
    })),
    top_publications: userPubs.slice(0, 3).map((p) => ({
      id: p.id,
      title: p.title,
      views: p.read_count,
      citations: p.citation_count,
    })),
  };
}
