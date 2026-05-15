"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { getAllExperiments, getProfile, type Experiment } from "@/lib/mock-db";
import { ExperimentSkeleton } from "@/components/Skeleton";

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function outcomeStyle(o: Experiment["outcome"]) {
  if (o === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (o === "partial")  return "bg-amber-50 text-amber-700 border-amber-200";
  if (o === "failed")   return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}
function outcomeLabel(o: Experiment["outcome"]) {
  if (o === "success") return "✅ Success";
  if (o === "partial")  return "⚠️ Partial";
  if (o === "failed")   return "❌ Negative result";
  return "— Ongoing";
}

type OutcomeFilter = "all" | "success" | "partial" | "failed";
const OUTCOME_FILTERS: { value: OutcomeFilter; label: string }[] = [
  { value: "all",     label: "All" },
  { value: "success", label: "✅ Success" },
  { value: "partial", label: "⚠️ Partial" },
  { value: "failed",  label: "❌ Negative" },
];

export default function ExperimentsPage() {
  const [loading, setLoading] = useState(true);
  const allExperiments = useMemo(() => getAllExperiments(), []);

  useEffect(() => { setLoading(false); }, []);

  // Collect all unique technique tags
  const allTechniques = useMemo(() => {
    const set = new Set<string>();
    allExperiments.forEach((e) => e.technique_tags.forEach((t) => set.add(t)));
    return ["All", ...Array.from(set).sort()];
  }, [allExperiments]);

  const [query,          setQuery]         = useState("");
  const [outcomeFilter,  setOutcomeFilter]  = useState<OutcomeFilter>("all");
  const [techniqueFilter, setTechniqueFilter] = useState("All");

  const filtered = useMemo(() => {
    return allExperiments.filter((e) => {
      // outcome filter
      if (outcomeFilter !== "all" && e.outcome !== outcomeFilter) return false;
      // technique filter
      if (techniqueFilter !== "All" && !e.technique_tags.includes(techniqueFilter)) return false;
      // text search
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          e.title.toLowerCase().includes(q) ||
          (e.hypothesis ?? "").toLowerCase().includes(q) ||
          (e.outcome_summary ?? "").toLowerCase().includes(q) ||
          (e.conditions ?? "").toLowerCase().includes(q) ||
          e.technique_tags.some((t) => t.toLowerCase().includes(q)) ||
          e.organism_tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allExperiments, query, outcomeFilter, techniqueFilter]);

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">🔬 Experiments</h1>
          <p className="text-sm text-slate-500">
            Browse {allExperiments.length} community experiments — real protocols, real outcomes, no hallucinations.
          </p>
        </div>

        {/* Search + Upload row */}
        <div className="flex gap-3 mb-5">
          <div className="flex-1 relative">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">🔍</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by technique, organism, outcome…"
              className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 bg-white shadow-sm"
            />
          </div>
          <Link
            href="/experiments/new"
            className="flex items-center gap-2 bg-blue-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-colors whitespace-nowrap">
            + Upload
          </Link>
        </div>

        {/* Outcome filter pills */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {OUTCOME_FILTERS.map((f) => (
            <button key={f.value} onClick={() => setOutcomeFilter(f.value)}
              className={`text-sm px-3.5 py-1.5 rounded-full font-medium transition-colors ${
                outcomeFilter === f.value
                  ? "bg-blue-600 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Technique filter — horizontal scroll */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 scrollbar-hide">
          {allTechniques.map((t) => (
            <button key={t} onClick={() => setTechniqueFilter(t)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${
                techniqueFilter === t
                  ? "bg-slate-800 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-sm text-slate-500 mb-4">
            {filtered.length === allExperiments.length
              ? `${filtered.length} experiments`
              : `${filtered.length} of ${allExperiments.length} experiments`}
          </p>
        )}

        {/* Skeleton while loading */}
        {loading && (
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => <ExperimentSkeleton key={i} />)}
          </div>
        )}

        {/* Results */}
        {!loading && filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-4xl mb-3">🔎</div>
            <p className="font-semibold text-slate-800 mb-1">No experiments match your filters</p>
            <p className="text-sm text-slate-500 mb-4">Try adjusting the search or filters above.</p>
            <button
              onClick={() => { setQuery(""); setOutcomeFilter("all"); setTechniqueFilter("All"); }}
              className="text-sm text-blue-600 hover:underline">
              Clear all filters
            </button>
          </div>
        ) : !loading && (
          <div className="space-y-4">
            {filtered.map((exp) => {
              const author = getProfile(exp.user_id);
              return (
                <Link key={exp.id} href={`/experiments/${exp.id}`}
                  className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${outcomeStyle(exp.outcome)}`}>
                        {outcomeLabel(exp.outcome)}
                      </span>
                      {exp.parent_id && (
                        <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 rounded-full px-2 py-0.5">
                          🔁 Fork
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{exp.protocol_version}</span>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(exp.created_at)}</span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 mb-1 leading-snug">{exp.title}</h3>

                  {author && (
                    <p className="text-xs text-slate-500 mb-2">
                      {author.full_name}{author.institution ? ` · ${author.institution}` : ""}
                    </p>
                  )}

                  {exp.outcome_summary && (
                    <p className="text-sm text-slate-600 line-clamp-2 mb-3">{exp.outcome_summary}</p>
                  )}

                  <div className="flex flex-wrap gap-1.5">
                    {exp.technique_tags.map((t) => (
                      <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>
                    ))}
                    {exp.organism_tags.map((t) => (
                      <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 border border-emerald-100">{t}</span>
                    ))}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
