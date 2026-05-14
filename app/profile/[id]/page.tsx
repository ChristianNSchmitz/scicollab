"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import {
  getProfile, getMockProfile, getUserPublications, getAllExperiments,
  isFollowing, toggleFollow, startConversation,
  MOCK_USER_ID, type Profile, type Publication, type Experiment,
} from "@/lib/mock-db";

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const TAB_LIST = ["Overview", "Publications", "Experiments", "About"] as const;
type Tab = typeof TAB_LIST[number];

export default function ProfilePage() {
  const { id }   = useParams<{ id: string }>();
  const router   = useRouter();
  const resolvedId = id === "me" ? MOCK_USER_ID : id;

  const [profile, setProfile]   = useState<Profile | null>(null);
  const [pubs, setPubs]         = useState<Publication[]>([]);
  const [exps, setExps]         = useState<Experiment[]>([]);
  const [following, setFollowing] = useState(false);
  const [tab, setTab]           = useState<Tab>("Overview");
  const [notFound, setNotFound] = useState(false);

  const isSelf = resolvedId === MOCK_USER_ID;

  useEffect(() => {
    const p = getProfile(resolvedId);
    if (!p) { setNotFound(true); return; }
    setProfile(p);
    setPubs(getUserPublications(resolvedId));
    setExps(getAllExperiments().filter((e) => e.user_id === resolvedId && e.visibility === "public"));
    setFollowing(isFollowing(resolvedId));
  }, [resolvedId]);

  function handleFollow() {
    const now = toggleFollow(resolvedId);
    setFollowing(now);
  }

  async function handleMessage() {
    const conv = startConversation(resolvedId);
    router.push(`/messages?conv=${conv.id}`);
  }

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

  const completeness = profile.profile_completeness ?? 0;

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
                {profile.orcid_id && (
                  <span className="text-xs text-slate-500 border border-slate-200 rounded-full px-2 py-0.5">🆔 ORCID</span>
                )}
              </div>
              <p className="text-slate-600 mt-0.5">{profile.role}{profile.institution ? ` · ${profile.institution}` : ""}</p>
              <p className="text-sm text-slate-500 mt-0.5">{profile.research_domain}</p>
              {profile.bio && <p className="text-sm text-slate-600 mt-2 max-w-xl leading-relaxed">{profile.bio}</p>}
            </div>

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
                  <p className="text-xs text-slate-500">{completeness}% — {completeness < 80 ? "add bio & ORCID to improve visibility" : "great profile!"}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Publications ── */}
        {tab === "Publications" && (
          <div className="space-y-4">
            {pubs.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <p className="text-3xl mb-2">📄</p>
                <p className="font-semibold text-slate-800">No publications yet</p>
                {isSelf && <Link href="/publications/new" className="text-sm text-blue-600 hover:underline mt-1 block">+ Upload your first publication</Link>}
              </div>
            ) : pubs.map((pub) => (
              <Link key={pub.id} href={`/publications/${pub.id}`}
                className="block bg-white border border-slate-200 rounded-xl p-5 hover:border-blue-200 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${pub.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                        {pub.type === "paper" ? "📄" : pub.type === "preprint" ? "📋" : pub.type === "dataset" ? "🗄️" : "💻"} {pub.status}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-900 leading-snug">{pub.title}</h3>
                    <p className="text-xs text-slate-500 mt-1">{pub.authors.join(", ")}</p>
                    <p className="text-xs text-slate-400">{pub.journal || "arXiv"} · {pub.year}{pub.doi ? ` · DOI: ${pub.doi}` : ""}</p>
                  </div>
                  <div className="text-right flex-shrink-0 text-xs text-slate-400 space-y-0.5">
                    <p className="font-medium text-slate-700">{pub.citation_count} <span className="font-normal">citations</span></p>
                    <p>{pub.read_count.toLocaleString()} reads</p>
                    <p>❤️ {pub.like_count}</p>
                  </div>
                </div>
                {pub.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {pub.tags.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>)}
                  </div>
                )}
              </Link>
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
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <h3 className="font-semibold text-slate-900">Academic info</h3>
              {[
                ["Role",            profile.role],
                ["Institution",     profile.institution],
                ["Research domain", profile.research_domain],
                ["ORCID",           profile.orcid_id],
                ["Joined",          profile.joined_at ? new Date(profile.joined_at).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : null],
              ].map(([label, value]) => value ? (
                <div key={label as string}>
                  <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                  <p className="text-sm text-slate-800 mt-0.5">{value}</p>
                </div>
              ) : null)}
            </div>

            {Object.keys(profile.social_links ?? {}).length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <h3 className="font-semibold text-slate-900 mb-3">Links</h3>
                <div className="space-y-2">
                  {profile.social_links?.twitter   && <a href={`https://twitter.com/${profile.social_links.twitter.replace("@","")}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">🐦 {profile.social_links.twitter}</a>}
                  {profile.social_links?.github    && <a href={`https://github.com/${profile.social_links.github}`} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">🐙 github.com/{profile.social_links.github}</a>}
                  {profile.social_links?.website   && <a href={profile.social_links.website} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">🌐 {profile.social_links.website}</a>}
                  {profile.social_links?.linkedin  && <a href={profile.social_links.linkedin} target="_blank" rel="noopener" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">💼 LinkedIn</a>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
