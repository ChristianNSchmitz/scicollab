import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

type SearchResult = {
  id: string;
  title: string;
  outcome: string | null;
  outcome_summary: string | null;
  technique_tags: string[];
  organism_tags: string[];
  conditions: string | null;
  methods: string | null;
  created_at: string;
  user_id: string;
};

function computeMatch(exp: SearchResult, query: string): number {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 0;

  let totalScore = 0;
  for (const term of terms) {
    let termScore = 0;
    if (exp.title?.toLowerCase().includes(term)) termScore += 50;
    if (exp.technique_tags?.some((t) => t.toLowerCase().includes(term))) termScore += 30;
    if (exp.organism_tags?.some((t) => t.toLowerCase().includes(term))) termScore += 25;
    if (exp.conditions?.toLowerCase().includes(term)) termScore += 15;
    if (exp.outcome_summary?.toLowerCase().includes(term)) termScore += 10;
    if (exp.methods?.toLowerCase().includes(term)) termScore += 5;
    totalScore += Math.min(100, termScore);
  }
  return Math.min(99, Math.round(totalScore / terms.length));
}

function matchLabel(pct: number): { label: string; color: string } {
  if (pct >= 70) return { label: "MATCH", color: "bg-emerald-100 text-emerald-700 border-emerald-200" };
  if (pct >= 40) return { label: "RELATED", color: "bg-blue-100 text-blue-700 border-blue-200" };
  return { label: "PARTIAL", color: "bg-slate-100 text-slate-600 border-slate-200" };
}

function outcomeStyle(outcome: string | null) {
  if (outcome === "success") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (outcome === "partial") return "bg-amber-50 text-amber-700 border-amber-200";
  if (outcome === "failed") return "bg-red-50 text-red-700 border-red-200";
  return "bg-slate-50 text-slate-500 border-slate-200";
}

function outcomeLabel(outcome: string | null) {
  if (outcome === "success") return "✅ Success";
  if (outcome === "partial") return "⚠️ Partial";
  if (outcome === "failed") return "❌ Negative result";
  return "—";
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const supabase = await createClient();

  let results: SearchResult[] = [];
  let profiles: Record<string, { full_name: string | null; institution: string | null }> = {};

  if (query) {
    const terms = query.split(/\s+/).filter(Boolean);
    const orFilter = terms
      .flatMap((t) => [
        `title.ilike.%${t}%`,
        `methods.ilike.%${t}%`,
        `conditions.ilike.%${t}%`,
        `outcome_summary.ilike.%${t}%`,
      ])
      .join(",");

    const { data } = await supabase
      .from("experiments")
      .select("id, title, outcome, outcome_summary, technique_tags, organism_tags, conditions, methods, created_at, user_id")
      .or(orFilter)
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .limit(20);

    results = (data ?? []) as SearchResult[];

    if (results.length > 0) {
      const userIds = [...new Set(results.map((r) => r.user_id))];
      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, institution")
        .in("id", userIds);

      profiles = Object.fromEntries((profileData ?? []).map((p) => [p.id, p]));
    }

    results.sort((a, b) => computeMatch(b, query) - computeMatch(a, query));
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
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Search & Discover</h1>
          <p className="text-slate-500 text-sm max-w-lg mx-auto">
            AI-grounded discovery across all structured experiments. Results always link to a real artifact — no hallucinated protocols.
          </p>
        </div>

        {/* Search form */}
        <form method="get" action="/search" className="mb-10">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-base">🔍</span>
              <input
                name="q"
                type="text"
                defaultValue={query}
                placeholder={`"Western blot optimisation — low signal in HEK293 cells, transfer buffer pH 8.3"`}
                className="w-full border border-slate-200 rounded-xl pl-10 pr-4 py-3.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 bg-white shadow-sm"
                autoFocus={!query}
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-3.5 rounded-xl font-semibold hover:bg-blue-700 transition-colors text-sm shadow-sm"
            >
              Search
            </button>
          </div>
        </form>

        {/* Results */}
        {!query && (
          <div className="text-center py-16">
            <div className="text-5xl mb-4">🔬</div>
            <p className="text-slate-500 text-sm">
              Search across all public experiments by technique, organism, protocol, or outcome.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {["Western Blot", "CRISPR-Cas9", "RNA-seq", "Flow Cytometry", "HEK293", "ELISA"].map((tag) => (
                <a
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 hover:bg-blue-100 transition-colors"
                >
                  {tag}
                </a>
              ))}
            </div>
          </div>
        )}

        {query && results.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200">
            <div className="text-4xl mb-3">🔎</div>
            <p className="font-semibold text-slate-800 mb-1">No experiments found for &ldquo;{query}&rdquo;</p>
            <p className="text-sm text-slate-500 max-w-sm mx-auto">
              No hallucinated protocols here — the AI only surfaces real, structured experiments.
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
                const pct = computeMatch(exp, query);
                const match = matchLabel(pct);
                const author = profiles[exp.user_id];
                return (
                  <Link
                    key={exp.id}
                    href={`/experiments/${exp.id}`}
                    className="block bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-200 hover:shadow-sm transition-all"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${match.color}`}>
                          {match.label} {pct}%
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${outcomeStyle(exp.outcome)}`}>
                          {outcomeLabel(exp.outcome)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 flex-shrink-0">{timeAgo(exp.created_at)}</span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 mb-1 leading-snug">{exp.title}</h3>

                    {author && (
                      <p className="text-xs text-slate-500 mb-2">
                        {author.full_name ?? "Researcher"}
                        {author.institution ? ` · ${author.institution}` : ""}
                      </p>
                    )}

                    {exp.outcome_summary && (
                      <p className="text-sm text-slate-600 line-clamp-2 mb-3">{exp.outcome_summary}</p>
                    )}

                    {(exp.technique_tags?.length > 0 || exp.organism_tags?.length > 0) && (
                      <div className="flex flex-wrap gap-1.5">
                        {exp.technique_tags?.map((t) => (
                          <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2 py-0.5 border border-blue-100">{t}</span>
                        ))}
                        {exp.organism_tags?.map((t) => (
                          <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2 py-0.5 border border-emerald-100">{t}</span>
                        ))}
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
