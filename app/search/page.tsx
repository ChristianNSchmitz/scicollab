"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { searchExperiments, getProfile, type Experiment } from "@/lib/mock-db";

type Result = Experiment & { matchPct: number };

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

function SearchInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQ = searchParams.get("q") ?? "";

  const [input, setInput]     = useState(initialQ);
  const [query, setQuery]     = useState(initialQ);
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    if (query.trim()) setResults(searchExperiments(query));
    else setResults([]);
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setQuery(input);
    router.replace(`/search?q=${encodeURIComponent(input)}`, { scroll: false });
  }

  function pickTag(tag: string) {
    setInput(tag); setQuery(tag);
    router.replace(`/search?q=${encodeURIComponent(tag)}`, { scroll: false });
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <Link href="/dashboard" className="text-xl font-bold text-blue-600">SciCollab</Link>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">← Dashboard</Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Search & Discover</h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            AI-grounded discovery across all structured experiments. Results always link to a real artifact — no hallucinated protocols.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-10">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`"Western blot — low signal HEK293 cells, pH 8.3"`}
                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 bg-white shadow-sm"
                autoFocus={!initialQ}
              />
            </div>
            <button type="submit" className="bg-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm shadow-sm">
              Search
            </button>
          </div>
        </form>

        {!query && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔬</div>
            <p className="text-slate-500 text-sm">Search across all experiments by technique, organism, protocol, or outcome.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SUGGESTED.map((tag) => (
                <button key={tag} onClick={() => pickTag(tag)}
                  className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 hover:bg-blue-100 transition-colors">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}

        {query && results.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-4xl mb-3">🔎</div>
            <p className="font-semibold text-slate-800 mb-1">No experiments found for &ldquo;{query}&rdquo;</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              No hallucinated protocols — the AI only surfaces real, structured experiments.
              Try different keywords or{" "}
              <Link href="/experiments/new" className="text-blue-600 underline">upload yours</Link>.
            </p>
          </div>
        )}

        {query && results.length > 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-slate-500">
                {results.length} result{results.length !== 1 ? "s" : ""} for <span className="font-medium text-slate-800">&ldquo;{query}&rdquo;</span>
              </p>
              <p className="text-xs text-slate-400">Grounded · No hallucinations</p>
            </div>
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
                    {(exp.technique_tags?.length > 0 || exp.organism_tags?.length > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {exp.technique_tags?.map((t) => <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>)}
                        {exp.organism_tags?.map((t)  => <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 border border-emerald-100">{t}</span>)}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          </>
        )}
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
