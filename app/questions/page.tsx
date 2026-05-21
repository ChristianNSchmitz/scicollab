"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getStandaloneQuestions, getProfile, type StandaloneQuestion } from "@/lib/mock-db";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SORTS = ["Top Voted", "Newest", "Unanswered"] as const;
type Sort = typeof SORTS[number];

const HOT_TAGS = ["RNA-seq", "CRISPR-Cas9", "Western Blot", "Organoid", "Single-cell", "Bioinformatics", "Mass Spectrometry"];

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<StandaloneQuestion[]>([]);
  const [sort, setSort]       = useState<Sort>("Top Voted");
  const [search, setSearch]   = useState("");
  const [tagFilter, setTagFilter] = useState("");

  useEffect(() => { setQuestions(getStandaloneQuestions()); }, []);

  const visible = questions
    .filter((q) => {
      const matchSearch = !search || q.title.toLowerCase().includes(search.toLowerCase()) || q.body.toLowerCase().includes(search.toLowerCase());
      const matchTag = !tagFilter || q.tags.some((t) => t.toLowerCase().includes(tagFilter.toLowerCase()));
      return matchSearch && matchTag;
    })
    .sort((a, b) => {
      if (sort === "Newest") return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sort === "Unanswered") return a.answers.length - b.answers.length;
      return b.vote_count - a.vote_count;
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid md:grid-cols-4 gap-6">
          {/* Sidebar */}
          <div className="md:col-span-1 space-y-4">
            <Link href="/questions/new"
              className="block w-full bg-blue-600 text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-blue-700 transition-colors text-center">
              + Ask a Question
            </Link>

            {/* Sorts */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Sort by</h3>
              {SORTS.map((s) => (
                <button key={s} onClick={() => setSort(s)}
                  className={`w-full text-left text-sm px-3 py-2 rounded-lg font-medium transition-colors ${sort === s ? "bg-blue-50 text-blue-600" : "text-slate-600 hover:bg-slate-50"}`}>
                  {s === "Top Voted" ? "🔥 Top Voted" : s === "Newest" ? "🕐 Newest" : "❓ Unanswered"}
                </button>
              ))}
            </div>

            {/* Hot tags */}
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Hot tags</h3>
              <div className="flex flex-wrap gap-1.5">
                {HOT_TAGS.map((t) => (
                  <button key={t} onClick={() => setTagFilter(tagFilter === t ? "" : t)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${tagFilter === t ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100"}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-slate-900">Scientific Q&A</h1>
              <p className="text-sm text-slate-500">{visible.length} questions</p>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions…"
                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-blue-500 bg-white shadow-sm" />
            </div>

            {/* List */}
            {visible.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
                <p className="text-3xl mb-3">❓</p>
                <p className="font-semibold text-slate-800 mb-2">No questions yet</p>
                <p className="text-sm text-slate-500 mb-5 max-w-xs mx-auto">Be the first to ask — or browse experiments to find something worth asking about.</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Link href="/questions/new"
                    className="inline-block bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors">
                    Ask a Question
                  </Link>
                  <Link href="/experiments"
                    className="inline-block border border-slate-200 text-slate-700 text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                    Browse Experiments
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((q) => {
                  const asker = getProfile(q.user_id);
                  return (
                    <Link key={q.id} href={`/questions/${q.id}`}
                      className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-sm transition-all">
                      <div className="flex gap-4">
                        {/* Vote + answer counts */}
                        <div className="flex flex-col items-center gap-2 flex-shrink-0 min-w-[52px]">
                          <div className={`text-center px-2 py-1.5 rounded-lg text-sm font-bold ${q.vote_count >= 20 ? "bg-emerald-50 text-emerald-700" : "bg-slate-50 text-slate-700"}`}>
                            <p>{q.vote_count}</p>
                            <p className="text-xs font-normal text-slate-400">votes</p>
                          </div>
                          <div className={`text-center px-2 py-1.5 rounded-lg text-sm font-bold ${q.is_answered ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-700"}`}>
                            <p>{q.answers.length}</p>
                            <p className="text-xs font-normal opacity-70">ans.</p>
                          </div>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 leading-snug mb-1">{q.title}</h3>
                          <p className="text-sm text-slate-500 line-clamp-2 mb-2">{q.body}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {q.tags.map((t) => (
                              <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-slate-400">
                            <span>{q.view_count} views</span>
                            <span>·</span>
                            <span>{asker?.full_name ?? "Researcher"}</span>
                            <span>·</span>
                            <span>{timeAgo(q.created_at)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
