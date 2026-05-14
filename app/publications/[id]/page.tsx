"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getPublication, getProfile, toggleLikePublication, getAllPublications, MOCK_USER_ID, type Publication } from "@/lib/mock-db";

export default function PublicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [pub, setPub]     = useState<Publication | null>(null);
  const [related, setRelated] = useState<Publication[]>([]);

  useEffect(() => {
    const p = getPublication(id);
    setPub(p);
    if (p) {
      const all = getAllPublications().filter((x) => x.id !== id);
      setRelated(all.filter((x) => x.tags.some((t) => p.tags.includes(t))).slice(0, 4));
    }
  }, [id]);

  function handleLike() {
    if (!pub) return;
    const updated = toggleLikePublication(pub.id);
    if (updated) setPub(updated);
  }

  if (!pub) return (
    <div className="min-h-screen bg-slate-50"><NavBar />
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  const author   = getProfile(pub.user_id);
  const hasLiked = pub.liked_by.includes(MOCK_USER_ID);
  const typeLabel = { paper: "Journal Paper", preprint: "Preprint", dataset: "Dataset", code: "Code", thesis: "Thesis" }[pub.type] ?? "Publication";
  const typeIcon  = { paper: "📄", preprint: "📋", dataset: "🗄️", code: "💻", thesis: "🎓" }[pub.type] ?? "📄";

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-3 gap-6">
          {/* Main */}
          <div className="md:col-span-2 space-y-6">
            {/* Header card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className="text-2xl">{typeIcon}</span>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${pub.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                  {typeLabel}
                </span>
                {pub.doi && (
                  <a href={`https://doi.org/${pub.doi}`} target="_blank" rel="noopener"
                    className="text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded px-2 py-0.5 hover:underline font-mono">
                    DOI: {pub.doi}
                  </a>
                )}
                {pub.arxiv_id && (
                  <a href={`https://arxiv.org/abs/${pub.arxiv_id}`} target="_blank" rel="noopener"
                    className="text-xs text-slate-600 border border-slate-200 rounded px-2 py-0.5 hover:underline font-mono">
                    arXiv:{pub.arxiv_id}
                  </a>
                )}
              </div>

              <h1 className="text-xl font-bold text-slate-900 leading-snug mb-3">{pub.title}</h1>

              <p className="text-sm text-slate-600 mb-1">{pub.authors.join(", ")}</p>
              <p className="text-sm text-slate-500">{pub.journal || "arXiv preprint"} · {pub.year}</p>

              {/* Tags */}
              {pub.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {pub.tags.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-1 border border-blue-100">{t}</span>)}
                </div>
              )}

              {/* Action bar */}
              <div className="flex items-center gap-3 mt-5 pt-4 border-t border-slate-100">
                <button onClick={handleLike}
                  className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg transition-colors ${hasLiked ? "bg-red-50 text-red-600 border border-red-200" : "border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                  {hasLiked ? "❤️" : "🤍"} {pub.like_count}
                </button>
                <button onClick={() => navigator.clipboard.writeText(`https://scicollab.io/publications/${pub.id}`)}
                  className="flex items-center gap-2 text-sm border border-slate-200 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50">
                  🔗 Share
                </button>
                <button onClick={() => navigator.clipboard.writeText(`${pub.authors.join(", ")} (${pub.year}). ${pub.title}. ${pub.journal || "arXiv"}. ${pub.doi ? `https://doi.org/${pub.doi}` : ""}`)}
                  className="flex items-center gap-2 text-sm border border-slate-200 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50">
                  📝 Cite
                </button>
              </div>
            </div>

            {/* Abstract */}
            {pub.abstract && (
              <div className="bg-white border border-slate-200 rounded-2xl p-6">
                <h2 className="font-semibold text-slate-900 mb-3">Abstract</h2>
                <p className="text-sm text-slate-700 leading-relaxed">{pub.abstract}</p>
              </div>
            )}

            {/* Metrics */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6">
              <h2 className="font-semibold text-slate-900 mb-4">Impact Metrics</h2>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { label: "Citations", value: pub.citation_count, icon: "📈" },
                  { label: "Reads",     value: pub.read_count.toLocaleString(), icon: "👁️" },
                  { label: "Likes",     value: pub.like_count, icon: "❤️" },
                ].map((m) => (
                  <div key={m.label} className="text-center bg-slate-50 rounded-xl p-4">
                    <p className="text-2xl mb-1">{m.icon}</p>
                    <p className="text-xl font-bold text-slate-900">{m.value}</p>
                    <p className="text-xs text-slate-500">{m.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Author card */}
            {author && (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 text-sm mb-3">Author</h3>
                <Link href={`/profile/${pub.user_id}`} className="flex items-center gap-3 hover:opacity-80">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold ${author.avatar_color || "bg-slate-600"}`}>
                    {author.avatar_initials || author.full_name[0]}
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{author.full_name}</p>
                    <p className="text-xs text-slate-500">{author.role}{author.institution ? ` · ${author.institution}` : ""}</p>
                  </div>
                </Link>
                <div className="grid grid-cols-2 gap-2 mt-3 text-center">
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="font-bold text-slate-900">{author.h_index}</p>
                    <p className="text-xs text-slate-500">h-index</p>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2">
                    <p className="font-bold text-slate-900">{author.publication_count}</p>
                    <p className="text-xs text-slate-500">papers</p>
                  </div>
                </div>
              </div>
            )}

            {/* Related */}
            {related.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <h3 className="font-semibold text-slate-900 text-sm mb-3">Related Publications</h3>
                <div className="space-y-3">
                  {related.map((r) => (
                    <Link key={r.id} href={`/publications/${r.id}`} className="block hover:bg-slate-50 rounded-lg p-2 -mx-2 transition-colors">
                      <p className="text-xs font-medium text-slate-800 leading-snug">{r.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{r.year} · {r.citation_count} citations</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Back */}
            <Link href="/publications" className="block text-center text-sm text-slate-500 hover:text-slate-700">
              ← All Publications
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
