"use client";

import { timeAgo } from "@/lib/utils";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getProfile, getMockProfile, getUserPublications, getAllExperiments,
  isFollowing, toggleFollow, startConversation, updateOrcidId,
  updateGoogleScholarId, saveMockProfile, getAuthorAnalytics,
  updateProfileStats, importPublicationsFromData, getUserProjects,
  deletePublication, calcProfileCompleteness,
  getCurrentUserId,
  MOCK_USER_ID, type Profile, type Publication, type Experiment, type AnalyticsSeries,
} from "@/lib/mock-db";
import AcademicSync from "@/components/AcademicSync";


type SortMode = "date" | "impact" | "first_author";

const TAB_LIST = ["Overview", "Analytics", "Publications", "Experiments", "About"] as const;
type Tab = typeof TAB_LIST[number];

// Inline sparkline component for Analytics tab
function InlineSparkline({ data }: { data: AnalyticsSeries }) {
  if (!data || data.length === 0) return null;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const W = 300;
  const H = 80;
  const step = W / Math.max(data.length - 1, 1);
  const points = data.map((d, i) => ({
    x: i * step,
    y: H - (d.value / max) * 70,
  }));
  const polylinePoints = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPoints = `0,${H} ${polylinePoints} ${W},${H}`;
  const gradId = `spark-${Math.random().toString(36).slice(2, 7)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={polylinePoints} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProfilePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const resolvedId = id === "me" ? getCurrentUserId() : id;

  const [profile, setProfile]   = useState<Profile | null>(null);
  const [pubs, setPubs]         = useState<Publication[]>([]);
  const [exps, setExps]         = useState<Experiment[]>([]);
  const [following, setFollowing] = useState(false);
  const [tab, setTab]           = useState<Tab>("Overview");
  const [notFound, setNotFound] = useState(false);
  const [orcidSyncStatus, setOrcidSyncStatus] = useState<"idle" | "syncing" | "done" | "error">("idle");

  // ORCID state
  const [showOrcidInput, setShowOrcidInput] = useState(false);
  const [orcidInput, setOrcidInput]         = useState("");
  const [orcidSyncing, setOrcidSyncing]     = useState(false);
  const [orcidToast, setOrcidToast]         = useState("");

  // Google Scholar state
  const [showScholarInput, setShowScholarInput] = useState(false);
  const [scholarInput, setScholarInput]         = useState("");
  const [scholarSyncing, setScholarSyncing]     = useState(false);
  const [scholarToast, setScholarToast]         = useState("");

  // Publications sort + delete
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmTimer, setConfirmTimer]   = useState<ReturnType<typeof setTimeout> | null>(null);

  const isSelf = resolvedId === getCurrentUserId();

  useEffect(() => {
    const p = getProfile(resolvedId);
    if (!p) { setNotFound(true); return; }
    setProfile(p);
    setPubs(getUserPublications(resolvedId));
    setExps(getAllExperiments().filter((e) => e.user_id === resolvedId && e.visibility === "public"));
    setFollowing(isFollowing(resolvedId));

    // Auto-sync stats + publications from OpenAlex if this is the logged-in user and they have an ORCID
    if (resolvedId === getCurrentUserId() && p.orcid_id) {
      setOrcidSyncStatus("syncing");
      fetch(`https://api.openalex.org/authors?filter=orcid:${p.orcid_id}`)
        .then((r) => r.ok ? r.json() : Promise.reject())
        .then(async (data) => {
          const author = data.results?.[0];
          if (!author) { setOrcidSyncStatus("error"); return; }

          updateProfileStats({
            h_index:          author.summary_stats?.h_index ?? p.h_index,
            citation_count:   author.cited_by_count ?? p.citation_count,
            publication_count: author.works_count ?? p.publication_count,
          });

          const authorId = author.id.replace("https://openalex.org/", "");
          const worksRes = await fetch(
            `https://api.openalex.org/works?filter=author.id:${authorId}&sort=cited_by_count:desc&per-page=50&select=id,title,publication_year,cited_by_count,doi,primary_location,authorships,abstract_inverted_index`
          );
          if (worksRes.ok) {
            const worksData = await worksRes.json();
            const items = (worksData.results ?? []).map((w: {
              title: string | null;
              authorships?: Array<{ author: { display_name: string } }>;
              publication_year: number | null;
              primary_location?: { source?: { display_name?: string } | null } | null;
              doi: string | null;
              cited_by_count: number;
              abstract_inverted_index?: Record<string, number[]> | null;
            }) => ({
              title: w.title ?? "Untitled",
              authors: (w.authorships ?? []).map((a) => a.author.display_name),
              year: w.publication_year ?? new Date().getFullYear(),
              journal: w.primary_location?.source?.display_name ?? null,
              doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
              arxiv_id: null,
              abstract: (() => {
                if (!w.abstract_inverted_index) return null;
                const words: string[] = [];
                for (const [word, positions] of Object.entries(w.abstract_inverted_index)) {
                  for (const pos of positions) words[pos] = word;
                }
                return words.filter(Boolean).join(" ");
              })(),
              citation_count: w.cited_by_count,
              tags: [],
            }));
            importPublicationsFromData(items);
          }

          const updated = getMockProfile();
          setProfile(updated);
          setPubs(getUserPublications(getCurrentUserId()));
          setOrcidSyncStatus("done");
          setTimeout(() => setOrcidSyncStatus("idle"), 4000);
        })
        .catch(() => setOrcidSyncStatus("error"));
    }
  }, [resolvedId]);

  function handleFollow() {
    const now = toggleFollow(resolvedId);
    setFollowing(now);
  }

  async function handleMessage() {
    const conv = startConversation(resolvedId);
    router.push(`/messages?conv=${conv.id}`);
  }

  function handleSaveOrcid() {
    if (!orcidInput.trim()) return;
    updateOrcidId(orcidInput.trim());
    const updated = getMockProfile();
    setProfile(updated);
    setShowOrcidInput(false);
    setOrcidInput("");
  }

  function handleOrcidImport() {
    setOrcidSyncing(true);
    setTimeout(() => {
      setOrcidSyncing(false);
      setOrcidToast("✅ 3 publications synced from ORCID");
      setTimeout(() => setOrcidToast(""), 3000);
    }, 1500);
  }

  function handleSaveScholar() {
    if (!scholarInput.trim()) return;
    updateGoogleScholarId(scholarInput.trim());
    const updated = getMockProfile();
    setProfile(updated);
    setShowScholarInput(false);
    setScholarInput("");
  }

  function handleScholarSync() {
    if (!profile) return;
    setScholarSyncing(true);
    setTimeout(() => {
      const newCitations = profile.citation_count + Math.floor(Math.random() * 20 + 3);
      const newHindex = profile.h_index + (Math.random() > 0.7 ? 1 : 0);
      saveMockProfile({ citation_count: newCitations, h_index: newHindex });
      setProfile(getMockProfile());
      setScholarSyncing(false);
      setScholarToast("✅ Stats synced from Google Scholar");
      setTimeout(() => setScholarToast(""), 3000);
    }, 2000);
  }

  function handleDeleteClick(pubId: string) {
    if (confirmDelete === pubId) {
      if (confirmTimer) clearTimeout(confirmTimer);
      deletePublication(pubId);
      setPubs(getUserPublications(resolvedId));
      setConfirmDelete(null);
    } else {
      if (confirmTimer) clearTimeout(confirmTimer);
      setConfirmDelete(pubId);
      const t = setTimeout(() => setConfirmDelete(null), 3000);
      setConfirmTimer(t);
    }
  }

  const sortedPubs = useMemo(() => {
    const copy = [...pubs];
    if (sortMode === "date") return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortMode === "impact") return copy.sort((a, b) => b.citation_count - a.citation_count);
    if (sortMode === "first_author") return copy.sort((a, b) => (a.authors[0] ?? "").localeCompare(b.authors[0] ?? ""));
    return copy;
  }, [pubs, sortMode]);

  if (notFound) return (
    <div className="min-h-screen bg-slate-50"><NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center">
          <p className="text-3xl mb-2">👤</p>
          <p className="font-semibold text-slate-800">Profile not found</p>
        </div>
      </div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-slate-50"><NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const completeness = calcProfileCompleteness(profile);
  const completenessHint =
    completeness < 40 ? "Add bio, ORCID & techniques to improve visibility" :
    completeness < 70 ? "Looking good — add social links to reach 70%" :
    completeness < 100 ? "Almost complete — link GitHub or website" :
    "Profile complete 🎉";
  const analytics = getAuthorAnalytics(resolvedId);
  const userProjects = getUserProjects(resolvedId).slice(0, 3);

  const totalProfileViews     = analytics.profile_views.reduce((s, d) => s + d.value, 0);
  const totalExperimentViews  = analytics.experiment_views.reduce((s, d) => s + d.value, 0);
  const totalPublicationViews = analytics.publication_views.reduce((s, d) => s + d.value, 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      {/* Hero */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-5">
            {/* Avatar */}
            <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-bold flex-shrink-0 ${profile.avatar_color || "bg-blue-600"}`}>
              {profile.avatar_initials || profile.full_name?.[0]?.toUpperCase() || "?"}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-bold text-slate-900">{profile.full_name}</h1>
                {profile.is_verified && (
                  <span className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5 font-medium">✓ Verified</span>
                )}
                {profile.orcid_verified && (
                  <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-medium">
                    ✅ ORCID Verified
                  </span>
                )}
                {profile.orcid_id && !profile.orcid_verified && (
                  <a href={`https://orcid.org/${profile.orcid_id}`} target="_blank" rel="noopener"
                    className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5 font-medium hover:bg-emerald-100">
                    🆔 ORCID
                  </a>
                )}
              </div>
              <p className="text-slate-600 mt-0.5">{profile.role}{profile.institution ? ` · ${profile.institution}` : ""}</p>
              <p className="text-sm text-slate-500 mt-0.5">{profile.research_domain}</p>
              {profile.bio && <p className="text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">{profile.bio}</p>}
            </div>

            {/* ORCID auto-sync status */}
            {isSelf && orcidSyncStatus !== "idle" && (
              <div className={`text-xs px-3 py-1.5 rounded-full font-medium flex items-center gap-1.5 flex-shrink-0 ${
                orcidSyncStatus === "syncing" ? "bg-blue-50 text-blue-600 border border-blue-200" :
                orcidSyncStatus === "done"    ? "bg-emerald-50 text-emerald-700 border border-emerald-200" :
                "bg-red-50 text-red-600 border border-red-200"
              }`}>
                {orcidSyncStatus === "syncing" && <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
                {orcidSyncStatus === "syncing" ? "Syncing from ORCID…" : orcidSyncStatus === "done" ? "✅ Stats & papers synced" : "⚠️ ORCID sync failed"}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 flex-shrink-0">
              {isSelf ? (
                <Link href="/onboarding"
                  className="text-sm border border-slate-200 px-4 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                  Edit Profile
                </Link>
              ) : (
                <>
                  <button onClick={handleFollow}
                    className={`text-sm px-4 py-2 rounded-xl font-semibold transition-colors ${following ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
                    {following ? "✓ Following" : "+ Follow"}
                  </button>
                  <button onClick={handleMessage}
                    className="text-sm border border-slate-200 px-4 py-2 rounded-xl font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    ✉️ Message
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Metrics bar */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 mt-6 pt-6 border-t border-slate-100">
            {[
              { label: "h-index",      value: profile.h_index },
              { label: "Citations",    value: profile.citation_count.toLocaleString() },
              { label: "Publications", value: profile.publication_count },
              { label: "Experiments",  value: exps.length },
              { label: "Followers",    value: profile.followers_count },
              { label: "Following",    value: profile.following_count },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className="text-xl font-bold text-slate-900">{m.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex gap-0 border-b border-slate-200 overflow-x-auto">
            {TAB_LIST.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-3 text-sm font-medium flex-shrink-0 border-b-2 transition-colors ${tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* ── Overview ── */}
        {tab === "Overview" && (
          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Analytics preview for self */}
              {isSelf && (
                <div className="flex gap-3">
                  {[
                    { label: "Profile views this month", value: totalProfileViews.toLocaleString() },
                    { label: "Total citations",          value: analytics.total_citations.toLocaleString() },
                    { label: "Total forks",              value: analytics.total_forks },
                  ].map((stat) => (
                    <div key={stat.label} className="flex-1 bg-white border border-slate-200 rounded-xl p-4 text-center">
                      <p className="text-xl font-bold text-slate-900">{stat.value}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent publications */}
              {pubs.length > 0 && (
                <div>
                  <h2 className="font-semibold text-slate-900 mb-3">Recent Publications</h2>
                  <div className="space-y-3">
                    {pubs.slice(0, 3).map((pub) => (
                      <Link key={pub.id} href={`/publications/${pub.id}`}
                        className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${pub.status === "published" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {pub.status === "published" ? "Published" : "Preprint"}
                            </span>
                            <p className="text-sm font-semibold text-slate-900 mt-1 leading-snug">{pub.title}</p>
                            <p className="text-xs text-slate-500 mt-1">{pub.journal || "arXiv"} · {pub.year}</p>
                          </div>
                          <div className="text-right flex-shrink-0 text-xs text-slate-400">
                            <p>{pub.citation_count} citations</p>
                            <p>{pub.read_count.toLocaleString()} reads</p>
                          </div>
                        </div>
                      </Link>
                    ))}
                    {pubs.length > 3 && (
                      <button onClick={() => setTab("Publications")} className="text-sm text-blue-600 hover:underline">
                        View all {pubs.length} publications →
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Recent experiments */}
              {exps.length > 0 && (
                <div>
                  <h2 className="font-semibold text-slate-900 mb-3">Recent Experiments</h2>
                  <div className="space-y-2">
                    {exps.slice(0, 3).map((exp) => (
                      <Link key={exp.id} href={`/experiments/${exp.id}`}
                        className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 hover:border-blue-200 transition-colors">
                        <span className="text-lg">{exp.outcome === "success" ? "✅" : exp.outcome === "failed" ? "❌" : "⚠️"}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{exp.title}</p>
                          <p className="text-xs text-slate-400">{exp.protocol_version} · {timeAgo(exp.created_at)}</p>
                        </div>
                        <div className="flex flex-wrap gap-1 flex-shrink-0">
                          {exp.technique_tags.slice(0, 2).map((t) => (
                            <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>
                          ))}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Projects section */}
              {userProjects.length > 0 && (
                <div>
                  <h2 className="font-semibold text-slate-900 mb-3">🗂 Projects</h2>
                  <div className="space-y-3">
                    {userProjects.map((proj) => (
                      <Link key={proj.id} href={`/projects/${proj.id}`}
                        className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-200 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${proj.status === "active" ? "bg-emerald-50 text-emerald-700" : proj.status === "completed" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                                {proj.status}
                              </span>
                              <h3 className="text-sm font-semibold text-slate-900">{proj.title}</h3>
                            </div>
                            <p className="text-xs text-slate-500 line-clamp-1">{proj.description}</p>
                            {proj.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {proj.tags.slice(0, 3).map((t) => (
                                  <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-1.5 py-0.5 border border-blue-100">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                          <span className="text-xs text-blue-600 flex-shrink-0">View →</span>
                        </div>
                      </Link>
                    ))}
                    <Link href="/projects" className="text-sm text-blue-600 hover:underline block">
                      View all projects →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              {/* Techniques */}
              {profile.techniques.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-900 text-sm mb-3">Techniques</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.techniques.map((t) => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Skills */}
              {profile.skills?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-900 text-sm mb-3">Skills</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.skills.map((s) => (
                      <span key={s} className="text-xs bg-slate-50 text-slate-600 rounded-full px-2.5 py-1 border border-slate-200">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Grants */}
              {profile.grants?.length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-900 text-sm mb-3">Funding</h3>
                  <ul className="space-y-1.5">
                    {profile.grants.map((g) => (
                      <li key={g} className="text-xs text-slate-600 flex items-start gap-1.5">
                        <span className="text-slate-400 mt-0.5">💰</span>{g}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Profile completeness (self only) */}
              {isSelf && (
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <h3 className="font-semibold text-slate-900 text-sm mb-2">Profile completeness</h3>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-1">
                    <div className="h-full bg-blue-600 rounded-full" style={{ width: `${completeness}%` }} />
                  </div>
                  <p className="text-xs text-slate-500">{completeness}% — {completenessHint}</p>
                </div>
              )}

              {/* Analytics link for self */}
              {isSelf && (
                <Link href="/analytics"
                  className="block bg-blue-50 border border-blue-200 rounded-xl p-4 hover:bg-blue-100 transition-colors">
                  <p className="text-sm font-semibold text-blue-800">📊 View Analytics</p>
                  <p className="text-xs text-blue-600 mt-0.5">Views, citations, forks — last 30 days</p>
                </Link>
              )}
            </div>
          </div>
        )}

        {/* ── Analytics ── */}
        {tab === "Analytics" && (
          isSelf ? (
            <div className="space-y-6">
              {/* Stat cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Profile Views",     value: totalProfileViews,     trend: "+12%", icon: "👁️" },
                  { label: "Experiment Views",  value: totalExperimentViews,  trend: "+8%",  icon: "🔬" },
                  { label: "Publication Views", value: totalPublicationViews, trend: "+15%", icon: "📄" },
                  { label: "New Followers",     value: analytics.total_followers_gained, trend: "+5%", icon: "👥" },
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xl">{s.icon}</span>
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">{s.trend}</span>
                    </div>
                    <p className="text-2xl font-bold text-slate-900 mt-2">{s.value.toLocaleString()}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Profile views sparkline */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h2 className="font-semibold text-slate-900 mb-4">Profile Views — Last 30 Days</h2>
                <InlineSparkline data={analytics.profile_views} />
                <div className="flex items-center justify-between mt-2 text-xs text-slate-400">
                  <span>{analytics.profile_views[0]?.date}</span>
                  <span>{analytics.profile_views[analytics.profile_views.length - 1]?.date}</span>
                </div>
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Total Forks",     value: analytics.total_forks,    icon: "🔁" },
                  { label: "Total Citations", value: analytics.total_citations, icon: "📈" },
                  { label: "New Followers",   value: analytics.total_followers_gained, icon: "👤" },
                ].map((s) => (
                  <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-5 text-center">
                    <p className="text-2xl mb-1">{s.icon}</p>
                    <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Top experiments + publications */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h2 className="font-semibold text-slate-900 mb-4">Top Experiments</h2>
                  {analytics.top_experiments.length === 0 ? (
                    <p className="text-sm text-slate-400">No experiments yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {analytics.top_experiments.map((e, i) => (
                        <div key={e.id} className="flex items-start gap-3">
                          <span className="text-sm font-bold text-slate-400 mt-0.5 w-5">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <Link href={`/experiments/${e.id}`} className="text-sm font-medium text-slate-800 hover:underline line-clamp-2">{e.title}</Link>
                            <div className="flex gap-3 mt-1 text-xs text-slate-400">
                              <span>👁 {e.views.toLocaleString()} views</span>
                              <span>🔁 {e.forks} forks</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-6">
                  <h2 className="font-semibold text-slate-900 mb-4">Top Publications</h2>
                  {analytics.top_publications.length === 0 ? (
                    <p className="text-sm text-slate-400">No publications yet.</p>
                  ) : (
                    <div className="space-y-4">
                      {analytics.top_publications.map((p, i) => (
                        <div key={p.id} className="flex items-start gap-3">
                          <span className="text-sm font-bold text-slate-400 mt-0.5 w-5">#{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <Link href={`/publications/${p.id}`} className="text-sm font-medium text-slate-800 hover:underline line-clamp-2">{p.title}</Link>
                            <div className="flex gap-3 mt-1 text-xs text-slate-400">
                              <span>👁 {p.views.toLocaleString()} reads</span>
                              <span>📈 {p.citations} citations</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-200">
              <p className="text-3xl mb-2">🔒</p>
              <p className="font-semibold text-slate-800">Analytics only visible to the profile owner</p>
              <p className="text-sm text-slate-500 mt-1">This researcher&apos;s analytics are private.</p>
            </div>
          )
        )}

        {/* ── Publications ── */}
        {tab === "Publications" && (
          <div className="space-y-4">
            {/* Sort buttons */}
            {pubs.length > 0 && (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-slate-400 mr-1">Sort:</span>
                {(["date", "impact", "first_author"] as SortMode[]).map((s) => (
                  <button key={s} onClick={() => setSortMode(s)}
                    className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${sortMode === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                    {s === "date" ? "Date" : s === "impact" ? "Impact" : "First Author"}
                  </button>
                ))}
              </div>
            )}

            {sortedPubs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <p className="text-3xl mb-2">📄</p>
                <p className="font-semibold text-slate-800">No publications yet</p>
                {isSelf && <Link href="/publications/new" className="text-sm text-blue-600 hover:underline mt-1 block">+ Upload your first publication</Link>}
              </div>
            ) : sortedPubs.map((pub) => (
              <div key={pub.id} className="bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-200 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${pub.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {pub.type === "paper" ? "📄" : pub.type === "preprint" ? "📋" : pub.type === "dataset" ? "🗄️" : "💻"} {pub.status}
                      </span>
                    </div>
                    <Link href={`/publications/${pub.id}`}>
                      <h3 className="font-semibold text-slate-900 leading-snug hover:text-blue-600">{pub.title}</h3>
                    </Link>
                    <p className="text-xs text-slate-500 mt-1">{pub.authors.join(", ")}</p>
                    <p className="text-xs text-slate-400">{pub.journal || "arXiv"} · {pub.year}{pub.doi ? ` · DOI: ${pub.doi}` : ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0 text-xs text-slate-400 space-y-0.5">
                    <p className="font-medium text-slate-700">{pub.citation_count} <span className="font-normal">citations</span></p>
                    <p>{pub.read_count.toLocaleString()} reads</p>
                    <p>❤️ {pub.like_count}</p>
                    {isSelf && (
                      <button
                        onClick={() => handleDeleteClick(pub.id)}
                        className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors mt-1 ${confirmDelete === pub.id ? "bg-red-600 text-white" : "text-slate-400 hover:text-red-500"}`}
                        title={confirmDelete === pub.id ? "Click again to confirm delete" : "Delete publication"}>
                        {confirmDelete === pub.id ? "Confirm?" : "🗑"}
                      </button>
                    )}
                  </div>
                </div>
                {pub.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {pub.tags.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Experiments ── */}
        {tab === "Experiments" && (
          <div className="space-y-3">
            {exps.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <p className="text-3xl mb-2">🔬</p>
                <p className="font-semibold text-slate-800">No public experiments</p>
                {isSelf && <Link href="/experiments/new" className="text-sm text-blue-600 hover:underline mt-1 block">+ Upload your first experiment</Link>}
              </div>
            ) : exps.map((exp) => (
              <Link key={exp.id} href={`/experiments/${exp.id}`}
                className="flex items-center gap-4 bg-white border border-slate-200 rounded-xl px-5 py-4 hover:border-blue-200 transition-colors">
                <span className="text-2xl">{exp.outcome === "success" ? "✅" : exp.outcome === "failed" ? "❌" : exp.outcome === "partial" ? "⚠️" : "⏳"}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-900">{exp.title}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{exp.protocol_version} · {timeAgo(exp.created_at)}</p>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {exp.technique_tags.slice(0, 2).map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>)}
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* ── About ── */}
        {tab === "About" && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              {/* Academic info */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                <h3 className="font-semibold text-slate-900">Academic info</h3>
                {[
                  ["Role",            profile.role],
                  ["Institution",     profile.institution],
                  ["Research domain", profile.research_domain],
                  ["Joined",          profile.joined_at ? new Date(profile.joined_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null],
                ].map(([label, value]) => value ? (
                  <div key={label as string}>
                    <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                    <p className="text-sm text-slate-800 mt-0.5">{value}</p>
                  </div>
                ) : null)}
              </div>

              {/* ORCID iD */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 mb-3">ORCID iD</h3>
                {orcidToast && <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg">{orcidToast}</div>}
                {profile.orcid_id ? (
                  <a href={`https://orcid.org/${profile.orcid_id}`} target="_blank" rel="noopener"
                    className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-mono px-3 py-1.5 rounded-full hover:bg-emerald-100">
                    🆔 {profile.orcid_id}
                  </a>
                ) : isSelf ? (
                  !showOrcidInput ? (
                    <button onClick={() => setShowOrcidInput(true)} className="text-sm border border-slate-200 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50">Connect ORCID</button>
                  ) : (
                    <div className="flex gap-2">
                      <input value={orcidInput} onChange={(e) => setOrcidInput(e.target.value)} placeholder="0000-0000-0000-0000"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-400" />
                      <button onClick={handleSaveOrcid} className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700">Save</button>
                      <button onClick={() => setShowOrcidInput(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
                    </div>
                  )
                ) : <p className="text-sm text-slate-400">No ORCID connected</p>}
              </div>

              {/* Google Scholar */}
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                  Google Scholar
                  <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 font-normal">Link only · no API</span>
                </h3>
                {scholarToast && <div className="mb-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2 rounded-lg">{scholarToast}</div>}
                {profile.google_scholar_id ? (
                  <a href={`https://scholar.google.com/citations?user=${profile.google_scholar_id}`} target="_blank" rel="noopener"
                    className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-800 text-sm font-mono px-3 py-1.5 rounded-full hover:bg-blue-100">
                    🎓 {profile.google_scholar_id}
                  </a>
                ) : isSelf ? (
                  !showScholarInput ? (
                    <button onClick={() => setShowScholarInput(true)} className="text-sm border border-slate-200 px-4 py-2 rounded-lg text-slate-700 hover:bg-slate-50">Connect Google Scholar</button>
                  ) : (
                    <div className="flex gap-2">
                      <input value={scholarInput} onChange={(e) => setScholarInput(e.target.value)} placeholder="e.g. abc123XYZ"
                        className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-blue-400" />
                      <button onClick={handleSaveScholar} className="text-sm bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700">Save</button>
                      <button onClick={() => setShowScholarInput(false)} className="text-sm text-slate-500 hover:text-slate-700">Cancel</button>
                    </div>
                  )
                ) : <p className="text-sm text-slate-400">No Google Scholar connected</p>}
              </div>

              {/* Social links */}
              {Object.keys(profile.social_links ?? {}).length > 0 && (
                <div className="bg-white border border-slate-200 rounded-xl p-5">
                  <h3 className="font-semibold text-slate-900 mb-3">Links</h3>
                  <div className="space-y-2">
                    {profile.social_links?.twitter  && <a href={`https://twitter.com/${profile.social_links.twitter.replace("@","")}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">🐦 {profile.social_links.twitter}</a>}
                    {profile.social_links?.github   && <a href={`https://github.com/${profile.social_links.github}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">🐙 github.com/{profile.social_links.github}</a>}
                    {profile.social_links?.website  && <a href={profile.social_links.website} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">🌐 {profile.social_links.website}</a>}
                    {profile.social_links?.linkedin && <a href={profile.social_links.linkedin} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">💼 LinkedIn</a>}
                  </div>
                </div>
              )}
            </div>

            {/* Right column — Live Academic Data (self only) */}
            <div>
              {isSelf ? (
                <AcademicSync onUpdate={() => {
                  const updated = getMockProfile();
                  setProfile(updated);
                  setPubs(getUserPublications(getCurrentUserId()));
                }} />
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-400 text-sm">
                  Academic sync only available on your own profile
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
