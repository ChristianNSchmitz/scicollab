"use client";

import { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  searchExperiments, searchProfiles, searchPublications, getProjects,
  getProfile, isFollowing, toggleFollow,
  MOCK_USER_ID, type Experiment, type Publication, type Profile, type Project,
} from "@/lib/mock-db";

type Tab = "Experiments" | "Publications" | "Projects" | "People";
const TABS: { value: Tab; icon: string }[] = [
  { value: "Experiments",  icon: "🔬" },
  { value: "Publications", icon: "📄" },
  { value: "Projects",     icon: "🗂" },
  { value: "People",       icon: "👥" },
];

type ExpResult = Experiment & { matchPct: number };

function matchLabel(pct: number) {
  if (pct >= 70) return { label: "MATCH",   color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (pct >= 40) return { label: "RELATED",  color: "bg-blue-100 text-blue-700 border-blue-200" };
  return              { label: "PARTIAL",  color: "bg-slate-100 text-slate-600 border-slate-200" };
}
function outcomeStyle(o: string | null) {
  if (o === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (o === "partial")  return "bg-amber-50 text-amber-700 border-amber-200";
  if (o === "failed")   return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}
function outcomeLabel(o: string | null) {
  if (o === "success") return "✅ Success";
  if (o === "partial")  return "⚠️ Partial";
  if (o === "failed")   return "❌ Negative result";
  return "—";
}
function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const SUGGESTED = ["Western Blot", "CRISPR-Cas9", "RNA-seq", "Organoid Culture", "HEK293", "ELISA", "Flow Cytometry"];

function FollowButton({ userId }: { userId: string }) {
  const [following, setFollowing] = useState(false);
  useEffect(() => { setFollowing(isFollowing(userId)); }, [userId]);
  if (userId === MOCK_USER_ID) return null;
  function handle() { setFollowing(toggleFollow(userId)); }
  return (
    <button onClick={handle}
      className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${following ? "bg-slate-100 text-slate-700 border border-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
      {following ? "✓ Following" : "+ Follow"}
    </button>
  );
}

// ─── Experiments results ──────────────────────────────────────
function ExperimentsTab({ query }: { query: string }) {
  const results = useMemo<ExpResult[]>(() =>
    query.trim() ? searchExperiments(query) : [], [query]);

  if (!query) return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">🔬</div>
      <p className="text-slate-500 text-sm">Search across all experiments by technique, organism, protocol, or outcome.</p>
    </div>
  );
  if (results.length === 0) return (
    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
      <div className="text-4xl mb-3">🔎</div>
      <p className="font-semibold text-slate-800 mb-1">No experiments found for &ldquo;{query}&rdquo;</p>
      <p className="text-sm text-slate-500">Try different keywords or <Link href="/experiments/new" className="text-blue-600 underline">upload yours</Link>.</p>
    </div>
  );
  return (
    <>
      <p className="text-sm text-slate-500 mb-4">{results.length} result{results.length !== 1 ? "s" : ""} for <span className="font-medium text-slate-800">&ldquo;{query}&rdquo;</span></p>
      <div className="space-y-4">
        {results.map((exp) => {
          const match  = matchLabel(exp.matchPct);
          const author = getProfile(exp.user_id);
          return (
            <Link key={exp.id} href={`/experiments/${exp.id}`}
              className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${match.color}`}>{match.label} {exp.matchPct}%</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${outcomeStyle(exp.outcome)}`}>{outcomeLabel(exp.outcome)}</span>
                </div>
                <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(exp.created_at)}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1 leading-snug">{exp.title}</h3>
              {author && <p className="text-xs text-slate-500 mb-2">{author.full_name}{author.institution ? ` · ${author.institution}` : ""}</p>}
              {exp.outcome_summary && <p className="text-sm text-slate-600 line-clamp-2 mb-3">{exp.outcome_summary}</p>}
              <div className="flex flex-wrap gap-1.5">
                {exp.technique_tags?.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>)}
                {exp.organism_tags?.map((t)  => <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 border border-emerald-100">{t}</span>)}
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

// ─── Publications results ─────────────────────────────────────
function PublicationsTab({ query }: { query: string }) {
  const results = useMemo<Publication[]>(() =>
    query.trim() ? searchPublications(query) : [], [query]);

  if (!query) return (
    <div className="text-center py-16">
      <div className="text-5xl mb-4">📄</div>
      <p className="text-slate-500 text-sm">Search papers, preprints, datasets, and code by title, author, or keyword.</p>
    </div>
  );
  if (results.length === 0) return (
    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
      <div className="text-4xl mb-3">🔎</div>
      <p className="font-semibold text-slate-800 mb-1">No publications found for &ldquo;{query}&rdquo;</p>
      <p className="text-sm text-slate-500">Try different keywords or <Link href="/publications/new" className="text-blue-600 underline">add yours</Link>.</p>
    </div>
  );
  const typeIcon: Record<string, string> = { paper: "📄", preprint: "📋", dataset: "🗄️", code: "💻", thesis: "🎓" };
  return (
    <>
      <p className="text-sm text-slate-500 mb-4">{results.length} result{results.length !== 1 ? "s" : ""} for <span className="font-medium text-slate-800">&ldquo;{query}&rdquo;</span></p>
      <div className="space-y-4">
        {results.map((pub) => {
          const author = getProfile(pub.user_id);
          const url    = pub.doi ? `https://doi.org/${pub.doi}` : pub.arxiv_id ? `https://arxiv.org/abs/${pub.arxiv_id}` : null;
          return (
            <div key={pub.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg">{typeIcon[pub.type] ?? "📄"}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${pub.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                    {pub.status}
                  </span>
                  <span className="text-xs text-slate-400">{pub.year}</span>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {url && (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 font-medium">
                      Read →
                    </a>
                  )}
                  <Link href={`/publications/${pub.id}`}
                    className="text-xs border border-slate-200 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-50">
                    Details
                  </Link>
                </div>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1 leading-snug">{pub.title}</h3>
              <p className="text-xs text-slate-500 mb-1">{pub.authors.slice(0, 3).join(", ")}{pub.authors.length > 3 ? " et al." : ""}</p>
              {author && <p className="text-xs text-slate-400 mb-2">{author.full_name}{author.institution ? ` · ${author.institution}` : ""}</p>}
              {pub.abstract && <p className="text-sm text-slate-600 line-clamp-2 mb-3">{pub.abstract}</p>}
              <div className="flex flex-wrap gap-1.5">
                {pub.tags.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>)}
              </div>
              <div className="flex gap-4 mt-3 text-xs text-slate-400">
                <span>📈 {pub.citation_count} citations</span>
                <span>👁️ {pub.read_count.toLocaleString()} reads</span>
                <span>❤️ {pub.like_count}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─── Projects results ─────────────────────────────────────────
function ProjectsTab({ query }: { query: string }) {
  const allProjects = useMemo<Project[]>(() => getProjects(), []);
  const results = useMemo<Project[]>(() => {
    if (!query.trim()) return allProjects;
    const q = query.toLowerCase();
    return allProjects.filter((p) =>
      p.title.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [allProjects, query]);

  const STATUS_BADGE: Record<Project["status"], string> = {
    active:    "bg-emerald-50 text-emerald-700 border-emerald-200",
    completed: "bg-blue-50 text-blue-700 border-blue-200",
    paused:    "bg-slate-100 text-slate-500 border-slate-200",
  };

  if (results.length === 0 && query) return (
    <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
      <div className="text-4xl mb-3">🔎</div>
      <p className="font-semibold text-slate-800 mb-1">No projects found for &ldquo;{query}&rdquo;</p>
      <p className="text-sm text-slate-500">Try different keywords or <Link href="/projects/new" className="text-blue-600 underline">start one</Link>.</p>
    </div>
  );
  return (
    <>
      {query && <p className="text-sm text-slate-500 mb-4">{results.length} project{results.length !== 1 ? "s" : ""} for <span className="font-medium text-slate-800">&ldquo;{query}&rdquo;</span></p>}
      {!query && <p className="text-sm text-slate-500 mb-4">All projects ({results.length})</p>}
      <div className="space-y-4">
        {results.map((proj) => {
          const owner = getProfile(proj.user_id);
          return (
            <Link key={proj.id} href={`/projects/${proj.id}`}
              className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3 mb-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_BADGE[proj.status]}`}>
                  {proj.status.charAt(0).toUpperCase() + proj.status.slice(1)}
                </span>
                <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(proj.updated_at)}</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">{proj.title}</h3>
              {owner && <p className="text-xs text-slate-500 mb-2">{owner.full_name}{owner.institution ? ` · ${owner.institution}` : ""}</p>}
              <p className="text-sm text-slate-600 line-clamp-2 mb-3">{proj.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {proj.tags.map((t) => <span key={t} className="text-xs bg-slate-100 text-slate-600 rounded-full px-2 py-0.5 border border-slate-200">{t}</span>)}
              </div>
              <p className="text-xs text-slate-400 mt-2">👥 {proj.collaborator_ids.length + 1} contributor{proj.collaborator_ids.length !== 0 ? "s" : ""} · 📄 {proj.publication_ids.length} publication{proj.publication_ids.length !== 1 ? "s" : ""}</p>
            </Link>
          );
        })}
      </div>
    </>
  );
}

// ─── People results ───────────────────────────────────────────
function PeopleTab({ query }: { query: string }) {
  const results = useMemo<Profile[]>(() => searchProfiles(query), [query]);

  return (
    <>
      {!query && <p className="text-sm text-slate-500 mb-4 font-medium">Suggested researchers</p>}
      {results.length === 0 && query ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
          <div className="text-4xl mb-3">👤</div>
          <p className="font-semibold text-slate-800 mb-1">No researchers found for &ldquo;{query}&rdquo;</p>
          <p className="text-sm text-slate-500">Try different keywords.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {results.map((p) => (
            <div key={p.id} className="bg-white border border-slate-200 rounded-2xl p-5 flex items-start gap-4">
              <Link href={`/profile/${p.id}`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-sm ${p.avatar_color || "bg-slate-600"}`}>
                  {p.avatar_initials || p.full_name[0]}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link href={`/profile/${p.id}`} className="font-semibold text-slate-900 text-sm hover:underline">{p.full_name}</Link>
                    {p.is_verified && <span className="ml-1.5 text-xs text-blue-600">✓</span>}
                    <p className="text-xs text-slate-500">{p.role}{p.institution ? ` · ${p.institution}` : ""}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{p.research_domain}</p>
                  </div>
                  <FollowButton userId={p.id} />
                </div>
                {p.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {p.skills.slice(0, 3).map((s) => (
                      <span key={s} className="text-xs bg-slate-50 text-slate-600 rounded-full px-2 py-0.5 border border-slate-200">{s}</span>
                    ))}
                    {p.skills.length > 3 && <span className="text-xs text-slate-400">+{p.skills.length - 3} more</span>}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────
function SearchInner() {
  const searchParams = useSearchParams();
  const router       = useRouter();

  const initialQ   = searchParams.get("q")   ?? "";
  const initialTab = (searchParams.get("tab") as Tab) ?? "Experiments";

  const [input,     setInput]     = useState(initialQ);
  const [query,     setQuery]     = useState(initialQ);
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(input);
    router.replace(`/search?q=${encodeURIComponent(input)}&tab=${activeTab}`, { scroll: false });
  }

  function pickTag(tag: string) {
    setInput(tag); setQuery(tag);
    router.replace(`/search?q=${encodeURIComponent(tag)}&tab=Experiments`, { scroll: false });
    setActiveTab("Experiments");
  }

  function switchTab(tab: Tab) {
    setActiveTab(tab);
    setInput(""); setQuery("");
    router.replace(`/search?q=&tab=${tab}`, { scroll: false });
  }

  const placeholder: Record<Tab, string> = {
    Experiments:  `"Western blot — low signal HEK293, pH 8.3"`,
    Publications: `"RNA-seq library preparation, UMI barcoding"`,
    Projects:     `"Protein trafficking, ELISA"`,
    People:       `"RNA-seq, CRISPR, Biochemistry"`,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Search & Discover</h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            Find experiments, papers, projects, and researchers across the community.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {TABS.map(({ value, icon }) => (
            <button key={value} onClick={() => switchTab(value)}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-colors ${activeTab === value ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600 hover:border-slate-300"}`}>
              {icon} {value}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mb-8">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={placeholder[activeTab]}
                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 bg-white shadow-sm"
                autoFocus={!initialQ}
              />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm shadow-sm">
              Search
            </button>
          </div>
        </form>

        {/* Suggested tags (Experiments tab only) */}
        {activeTab === "Experiments" && !query && (
          <div className="mt-2 flex flex-wrap justify-center gap-2 mb-8">
            {SUGGESTED.map((tag) => (
              <button key={tag} onClick={() => pickTag(tag)}
                className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 hover:bg-blue-100 transition-colors">
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Tab content */}
        {activeTab === "Experiments"  && <ExperimentsTab  query={query} />}
        {activeTab === "Publications" && <PublicationsTab query={query} />}
        {activeTab === "Projects"     && <ProjectsTab     query={query} />}
        {activeTab === "People"       && <PeopleTab       query={query} />}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense>
      <SearchInner />
    </Suspense>
  );
}
