"use client";

import { timeAgo } from "@/lib/utils";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getAllPublications, getProfile, toggleLikePublication, deletePublication, getCurrentUserId, type Publication } from "@/lib/mock-db";
import { useToast } from "@/lib/toast";
import { PublicationSkeleton } from "@/components/Skeleton";

const TYPES = ["All", "Paper", "Preprint", "Dataset", "Code"] as const;
type Filter = typeof TYPES[number];
type SortMode = "date" | "impact" | "first_author";


function typeIcon(t: Publication["type"]) {
  return { paper: "📄", preprint: "📋", dataset: "🗄️", code: "💻", thesis: "🎓" }[t] ?? "📄";
}

export default function PublicationsPage() {
  const [pubs, setPubs]       = useState<Publication[]>([]);
  const [filter, setFilter]   = useState<Filter>("All");
  const [search, setSearch]   = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("date");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmTimer, setConfirmTimer]   = useState<ReturnType<typeof setTimeout> | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    setPubs(getAllPublications());
    setLoading(false);
  }, []);

  function handleLike(id: string) {
    const updated = toggleLikePublication(id);
    if (updated) setPubs((prev) => prev.map((p) => p.id === id ? updated : p));
  }

  function handleDeleteClick(id: string) {
    if (confirmDelete === id) {
      // Second click — confirm delete
      if (confirmTimer) clearTimeout(confirmTimer);
      deletePublication(id);
      setPubs(getAllPublications());
      setConfirmDelete(null);
      toast("Publication deleted", "info");
    } else {
      // First click — arm confirmation
      if (confirmTimer) clearTimeout(confirmTimer);
      setConfirmDelete(id);
      const t = setTimeout(() => setConfirmDelete(null), 3000);
      setConfirmTimer(t);
    }
  }

  function sortPubs(list: Publication[]): Publication[] {
    const copy = [...list];
    if (sortMode === "date") return copy.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (sortMode === "impact") return copy.sort((a, b) => b.citation_count - a.citation_count);
    if (sortMode === "first_author") return copy.sort((a, b) => (a.authors[0] ?? "").localeCompare(b.authors[0] ?? ""));
    return copy;
  }

  const filtered = pubs
    .filter((p) => filter === "All" || p.type === filter.toLowerCase())
    .filter((p) => !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.authors.some((a) => a.toLowerCase().includes(search.toLowerCase())) || p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())));

  const visible = sortPubs(filtered);

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

        {/* Type filter + Sort */}
        <div className="flex flex-wrap gap-2 mb-4 items-center justify-between">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {TYPES.map((t) => (
              <button key={t} onClick={() => setFilter(t)}
                className={`flex-shrink-0 text-sm px-4 py-2 rounded-full font-medium transition-colors ${filter === t ? "bg-blue-600 text-white" : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"}`}>
                {t}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            {(["date", "impact", "first_author"] as SortMode[]).map((s) => (
              <button key={s} onClick={() => setSortMode(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${sortMode === s ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                {s === "date" ? "Date" : s === "impact" ? "Impact" : "First Author"}
              </button>
            ))}
          </div>
        </div>

        {/* Count */}
        {!loading && <p className="text-sm text-slate-500 mb-4">{visible.length} result{visible.length !== 1 ? "s" : ""}</p>}

        {/* Skeleton while loading */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => <PublicationSkeleton key={i} />)}
          </div>
        )}

        {/* List */}
        {!loading && visible.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <p className="text-3xl mb-2">📄</p>
            <p className="font-semibold text-slate-800">No publications found</p>
            <p className="text-sm text-slate-500 mt-1">Try a different search term or filter.</p>
          </div>
        ) : !loading && (
          <div className="space-y-4">
            {visible.map((pub) => {
              const author  = getProfile(pub.user_id);
              const currentId = getCurrentUserId();
              const hasLiked = pub.liked_by.includes(currentId);
              const isOwn = pub.user_id === currentId;
              const isConfirming = confirmDelete === pub.id;
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
                      {isOwn && (
                        <button
                          onClick={() => handleDeleteClick(pub.id)}
                          className={`text-xs px-2 py-1 rounded-lg font-medium transition-colors mt-1 ${isConfirming ? "bg-red-600 text-white" : "text-slate-400 hover:text-red-500"}`}
                          title={isConfirming ? "Click again to confirm delete" : "Delete publication"}
                          aria-label={isConfirming ? "Confirm delete publication" : "Delete publication"}>
                          {isConfirming ? "Confirm?" : "🗑"}
                        </button>
                      )}
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
                      className="text-xs text-slate-400 hover:text-slate-600" aria-label="Copy share link">
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
