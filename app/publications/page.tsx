"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getAllPublications, getProfile, toggleLikePublication, MOCK_USER_ID, type Publication } from "@/lib/mock-db";

const TYPES = ["All", "Paper", "Preprint", "Dataset", "Code"] as const;
type Filter = typeof TYPES[number];

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function typeIcon(t: Publication["type"]) {
  return { paper: "📄", preprint: "📋", dataset: "🗄️", code: "💻", thesis: "🎓" }[t] ?? "📄";
}

export default function PublicationsPage() {
  const [pubs, setPubs]     = useState<Publication[]>([]);
  const [filter, setFilter] = useState<Filter>("All");
  const [search, setSearch] = useState("");

  useEffect(() => { setPubs(getAllPublications()); }, []);

  function handleLike(id: string) {
    const updated = toggleLikePublication(id);
    if (updated) setPubs((prev) => prev.map((p) => p.id === id ? updated : p));
  }

  const visible = pubs
    .filter((p) => filter === "All" || p.type === filter.toLowerCase())
    .filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.authors.some((a) => a.toLowerCase().includes(search.toLowerCase())) || p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />

      <div className="max-w-4xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Publications</h1>
            <p className="text-sm text-slate-500 mt-0.5">Papers, preprints, datasets & code shared by the community</p>
          </div>
          <Link href="/publications/new"
            className="bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
            + Upload
          </Link>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, author, or keyword…"
            className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 bg-white shadow-sm" />
        </div>

        {/* Type filter */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1">
          {TYPES.map((t) => (
            <button key={t} onClick={() => setFilter(t)}
              className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-colors ${filter === t ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Count */}
        <p className="text-sm text-slate-500 mb-4">{visible.length} result{visible.length !== 1 ? "s" : ""}</p>

        {/* List */}
        {visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">📄</p>
            <p className="font-semibold text-slate-800">No publications found</p>
            <p className="text-sm text-slate-500 mt-1">Try a different search term or filter.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {visible.map((pub) => {
              const author  = getProfile(pub.user_id);
              const hasLiked = pub.liked_by.includes(MOCK_USER_ID);
              return (
                <div key={pub.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Type + status */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-lg">{typeIcon(pub.type)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${pub.status === "published" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"}`}>
                          {pub.status}
                        </span>
                        {pub.doi && <span className="text-xs text-slate-400 font-mono border border-slate-200 rounded px-1.5 py-0.5">DOI</span>}
                        {pub.arxiv_id && <span className="text-xs text-slate-400 font-mono border border-slate-200 rounded px-1.5 py-0.5">arXiv</span>}
                      </div>

                      {/* Title */}
                      <Link href={`/publications/${pub.id}`} className="font-semibold text-slate-900 hover:text-blue-600 leading-snug block">{pub.title}</Link>

                      {/* Authors + journal */}
                      <p className="text-xs text-slate-500 mt-1">{pub.authors.join(", ")}</p>
                      <p className="text-xs text-slate-400">{pub.journal || "arXiv"} · {pub.year}</p>

                      {/* Abstract snippet */}
                      {pub.abstract && (
                        <p className="text-sm text-slate-600 mt-2 line-clamp-2 leading-relaxed">{pub.abstract}</p>
                      )}

                      {/* Tags */}
                      {pub.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {pub.tags.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>)}
                        </div>
                      )}

                      {/* Author chip */}
                      {author && (
                        <Link href={`/profile/${pub.user_id}`} className="inline-flex items-center gap-1.5 mt-3 hover:opacity-80">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold ${author.avatar_color || "bg-slate-600"}`}>
                            {author.avatar_initials || author.full_name[0]}
                          </div>
                          <span className="text-xs text-slate-500">{author.full_name}{author.institution ? ` · ${author.institution}` : ""}</span>
                        </Link>
                      )}
                    </div>

                    {/* Metrics */}
                    <div className="flex-shrink-0 text-right space-y-1">
                      <p className="text-sm font-semibold text-slate-900">{pub.citation_count} <span className="text-xs font-normal text-slate-400">citations</span></p>
                      <p className="text-xs text-slate-400">{pub.read_count.toLocaleString()} reads</p>
                      <p className="text-xs text-slate-400">{timeAgo(pub.created_at)}</p>
                    </div>
                  </div>

                  {/* Action bar */}
                  <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100">
                    <button onClick={() => handleLike(pub.id)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${hasLiked ? "text-red-500" : "text-slate-400 hover:text-red-500"}`}>
                      {hasLiked ? "❤️" : "🤍"} {pub.like_count}
                    </button>
                    <Link href={`/publications/${pub.id}`} className="text-xs text-slate-400 hover:text-blue-600 font-medium">
                      💬 Discuss
                    </Link>
                    <button onClick={() => navigator.clipboard.writeText(`https://scicollab.io/publications/${pub.id}`)}
                      className="text-xs text-slate-400 hover:text-slate-600">
                      🔗 Share
                    </button>
                    <Link href={`/publications/${pub.id}`} className="ml-auto text-xs text-blue-600 hover:underline font-medium">
                      Read →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
