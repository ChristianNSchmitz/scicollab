"use client";

/**
 * AcademicSync — Live data from Semantic Scholar, OpenAlex & CrossRef.
 *
 * Semantic Scholar API  (free, CORS-open, no key needed)
 *   author search:  https://api.semanticscholar.org/graph/v1/author/search
 *   author papers:  https://api.semanticscholar.org/graph/v1/author/{id}/papers
 *
 * OpenAlex API  (free, CORS-open, no key needed)
 *   by ORCID:       https://api.openalex.org/authors?filter=orcid:{id}
 *   by name:        https://api.openalex.org/authors?search={name}
 *   works:          https://api.openalex.org/works?filter=author.id:{id}&per-page=50
 *
 * CrossRef API  (free, CORS-open, no key needed)
 *   by DOI:         https://api.crossref.org/works/{doi}
 *
 * Google Scholar has NO public API and actively blocks browsers — link-only.
 */

import { useState } from "react";
import {
  getMockProfile,
  updateProfileStats,
  updateSemanticScholarId,
  importPublicationsFromData,
  type Profile,
} from "@/lib/mock-db";

// ─── Types from external APIs ────────────────────────────────

interface SSAuthor {
  authorId: string;
  name: string;
  hIndex: number;
  citationCount: number;
  paperCount: number;
}

interface SSPaper {
  paperId: string;
  title: string;
  year: number | null;
  citationCount: number;
  journal?: { name: string } | null;
  externalIds?: { DOI?: string; ArXiv?: string } | null;
  authors?: { name: string }[];
  abstract?: string | null;
}

interface OAAuthor {
  id: string;
  display_name: string;
  summary_stats: { h_index: number; i10_index: number; "2yr_cited_by_count": number };
  cited_by_count: number;
  works_count: number;
  orcid: string | null;
}

interface OAWork {
  id: string;
  title: string | null;
  publication_year: number | null;
  cited_by_count: number;
  doi: string | null;
  primary_location?: { source?: { display_name?: string } | null } | null;
  authorships?: Array<{ author: { display_name: string } }>;
  abstract_inverted_index?: Record<string, number[]> | null;
}

// ─── Helpers ─────────────────────────────────────────────────

function Spinner() {
  return <span className="inline-block w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin align-middle mr-1" />;
}

function StatusBadge({ status }: { status: "idle" | "loading" | "ok" | "error"; msg?: string }) {
  if (status === "loading") return <span className="text-xs text-blue-600"><Spinner /> Fetching…</span>;
  return null;
}

/** Reconstruct abstract from OpenAlex inverted index */
function reconstructAbstract(inv: Record<string, number[]> | null | undefined): string | null {
  if (!inv) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(inv)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(" ");
}

// ─── Semantic Scholar section ─────────────────────────────────

function SemanticScholarSection({ profile, onUpdate }: { profile: Profile; onUpdate: () => void }) {
  const [query, setQuery]           = useState(profile.full_name);
  const [results, setResults]       = useState<SSAuthor[]>([]);
  const [selected, setSelected]     = useState<SSAuthor | null>(null);
  const [papers, setPapers]         = useState<SSPaper[]>([]);
  const [status, setStatus]         = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [paperStatus, setPaperStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [toast, setToast]           = useState("");
  const [importResult, setImportResult] = useState<{ added: number; skipped: number } | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setStatus("loading");
    setResults([]);
    setSelected(null);
    setPapers([]);
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/author/search?query=${encodeURIComponent(query)}&fields=name,hIndex,citationCount,paperCount&limit=8`
      );
      if (!res.ok) throw new Error("API error");
      const data = await res.json();
      const list: SSAuthor[] = (data.data ?? []).filter((a: SSAuthor) => a.paperCount > 0);
      setResults(list);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  async function handleSelect(author: SSAuthor) {
    setSelected(author);
    setPaperStatus("loading");
    setPapers([]);
    try {
      const res = await fetch(
        `https://api.semanticscholar.org/graph/v1/author/${author.authorId}/papers?fields=title,year,citationCount,journal,externalIds,authors,abstract&limit=50`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPapers(data.data ?? []);
      setPaperStatus("ok");
    } catch {
      setPaperStatus("error");
    }
  }

  function handleApply() {
    if (!selected) return;
    updateProfileStats({
      h_index: selected.hIndex,
      citation_count: selected.citationCount,
      publication_count: selected.paperCount,
      semantic_scholar_id: selected.authorId,
    });
    updateSemanticScholarId(selected.authorId);
    setToast(`✅ Stats updated — h-index: ${selected.hIndex}, ${selected.citationCount.toLocaleString()} citations`);
    setTimeout(() => setToast(""), 4000);
    onUpdate();
  }

  function handleImport() {
    if (!papers.length) return;
    const items = papers.map((p) => ({
      title: p.title ?? "Untitled",
      authors: (p.authors ?? []).map((a) => a.name),
      year: p.year ?? new Date().getFullYear(),
      journal: p.journal?.name ?? null,
      doi: p.externalIds?.DOI ?? null,
      arxiv_id: p.externalIds?.ArXiv ?? null,
      abstract: p.abstract ?? null,
      citation_count: p.citationCount,
      tags: [],
    }));
    const result = importPublicationsFromData(items);
    setImportResult(result);
    setToast(`✅ ${result.added} publications imported, ${result.skipped} already existed`);
    setTimeout(() => { setToast(""); setImportResult(null); }, 5000);
    onUpdate();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🔬</span>
        <h3 className="font-semibold text-slate-900">Semantic Scholar</h3>
        {profile.semantic_scholar_id && (
          <a
            href={`https://www.semanticscholar.org/author/${profile.semantic_scholar_id}`}
            target="_blank" rel="noopener"
            className="text-xs text-blue-600 hover:underline ml-auto"
          >
            View profile ↗
          </a>
        )}
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 rounded-lg">
          {toast}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search by name…"
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
        />
        <button
          onClick={handleSearch}
          disabled={status === "loading"}
          className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1"
        >
          {status === "loading" ? <><Spinner />Searching…</> : "🔍 Search"}
        </button>
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">❌ Search failed. Check your connection and try again.</p>
      )}

      {/* Results list */}
      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Select your profile</p>
          {results.map((author) => (
            <button
              key={author.authorId}
              onClick={() => handleSelect(author)}
              className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                selected?.authorId === author.authorId
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div>
                <span className="font-medium text-slate-900">{author.name}</span>
                <span className="ml-2 text-slate-400">· {author.paperCount} papers</span>
              </div>
              <div className="flex gap-3 text-xs text-slate-500 flex-shrink-0">
                <span>h={author.hIndex}</span>
                <span>{author.citationCount.toLocaleString()} cit.</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected author — actions */}
      {selected && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-blue-900">{selected.name}</p>
            <span className="text-xs text-blue-600">ID: {selected.authorId}</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white rounded-lg py-2">
              <p className="font-bold text-slate-900 text-base">{selected.hIndex}</p>
              <p className="text-slate-500">h-index</p>
            </div>
            <div className="bg-white rounded-lg py-2">
              <p className="font-bold text-slate-900 text-base">{selected.citationCount.toLocaleString()}</p>
              <p className="text-slate-500">Citations</p>
            </div>
            <div className="bg-white rounded-lg py-2">
              <p className="font-bold text-slate-900 text-base">{selected.paperCount}</p>
              <p className="text-slate-500">Papers</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="flex-1 text-sm bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
            >
              ✅ Apply stats to profile
            </button>
            <button
              onClick={handleImport}
              disabled={paperStatus === "loading" || !papers.length}
              className="flex-1 text-sm border border-blue-300 text-blue-700 py-2 rounded-lg hover:bg-blue-100 disabled:opacity-50 font-medium"
            >
              {paperStatus === "loading" ? <><Spinner />Loading papers…</> : `📚 Import ${papers.length} papers`}
            </button>
          </div>
          {importResult && (
            <p className="text-xs text-emerald-700">
              Added {importResult.added} new · {importResult.skipped} already in your library
            </p>
          )}
          <StatusBadge status={paperStatus} />
        </div>
      )}

      {results.length === 0 && status === "ok" && (
        <p className="text-sm text-slate-500">No results found. Try a different name or spelling.</p>
      )}
    </div>
  );
}

// ─── OpenAlex section ─────────────────────────────────────────

function OpenAlexSection({ profile, onUpdate }: { profile: Profile; onUpdate: () => void }) {
  const [query, setQuery]       = useState(profile.full_name);
  const [results, setResults]   = useState<OAAuthor[]>([]);
  const [selected, setSelected] = useState<OAAuthor | null>(null);
  const [works, setWorks]       = useState<OAWork[]>([]);
  const [status, setStatus]     = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [workStatus, setWorkStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [toast, setToast]       = useState("");

  async function handleSearch() {
    setStatus("loading");
    setResults([]);
    setSelected(null);
    setWorks([]);
    try {
      const url = profile.orcid_id
        ? `https://api.openalex.org/authors?filter=orcid:${profile.orcid_id}`
        : `https://api.openalex.org/authors?search=${encodeURIComponent(query)}&per-page=8`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results ?? []);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  async function handleSelect(author: OAAuthor) {
    setSelected(author);
    setWorkStatus("loading");
    setWorks([]);
    try {
      const id = author.id.replace("https://openalex.org/", "");
      const res = await fetch(
        `https://api.openalex.org/works?filter=author.id:${id}&sort=cited_by_count:desc&per-page=50&select=id,title,publication_year,cited_by_count,doi,primary_location,authorships,abstract_inverted_index`
      );
      if (!res.ok) throw new Error();
      const data = await res.json();
      setWorks(data.results ?? []);
      setWorkStatus("ok");
    } catch {
      setWorkStatus("error");
    }
  }

  function handleApply() {
    if (!selected) return;
    updateProfileStats({
      h_index: selected.summary_stats.h_index,
      citation_count: selected.cited_by_count,
      publication_count: selected.works_count,
    });
    setToast(`✅ Stats updated — h-index: ${selected.summary_stats.h_index}, ${selected.cited_by_count.toLocaleString()} citations`);
    setTimeout(() => setToast(""), 4000);
    onUpdate();
  }

  function handleImport() {
    if (!works.length) return;
    const items = works.map((w) => ({
      title: w.title ?? "Untitled",
      authors: (w.authorships ?? []).map((a) => a.author.display_name),
      year: w.publication_year ?? new Date().getFullYear(),
      journal: w.primary_location?.source?.display_name ?? null,
      doi: w.doi ? w.doi.replace("https://doi.org/", "") : null,
      arxiv_id: null,
      abstract: reconstructAbstract(w.abstract_inverted_index),
      citation_count: w.cited_by_count,
      tags: [],
    }));
    const result = importPublicationsFromData(items);
    setToast(`✅ ${result.added} publications imported, ${result.skipped} already existed`);
    setTimeout(() => setToast(""), 5000);
    onUpdate();
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🌐</span>
        <h3 className="font-semibold text-slate-900">OpenAlex</h3>
        <span className="text-xs text-slate-400 ml-auto">Open scholarly database</span>
      </div>

      {toast && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-3 py-2 rounded-lg">
          {toast}
        </div>
      )}

      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={profile.orcid_id ? `Using ORCID ${profile.orcid_id}` : "Search by name…"}
          disabled={!!profile.orcid_id}
          className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50 disabled:text-slate-400"
        />
        <button
          onClick={handleSearch}
          disabled={status === "loading"}
          className="text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-1"
        >
          {status === "loading" ? <><Spinner />Loading…</> : profile.orcid_id ? "🆔 Fetch by ORCID" : "🔍 Search"}
        </button>
      </div>

      {status === "error" && (
        <p className="text-sm text-red-600">❌ Fetch failed. Check your connection.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Select your profile</p>
          {results.map((author) => (
            <button
              key={author.id}
              onClick={() => handleSelect(author)}
              className={`w-full text-left flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-sm transition-colors ${
                selected?.id === author.id
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <span className="font-medium text-slate-900">{author.display_name}</span>
              <div className="flex gap-3 text-xs text-slate-500">
                <span>h={author.summary_stats.h_index}</span>
                <span>{author.cited_by_count.toLocaleString()} cit.</span>
                <span>{author.works_count} works</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="border border-indigo-200 bg-indigo-50 rounded-lg p-4 space-y-3">
          <p className="text-sm font-semibold text-indigo-900">{selected.display_name}</p>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-white rounded-lg py-2">
              <p className="font-bold text-slate-900 text-base">{selected.summary_stats.h_index}</p>
              <p className="text-slate-500">h-index</p>
            </div>
            <div className="bg-white rounded-lg py-2">
              <p className="font-bold text-slate-900 text-base">{selected.cited_by_count.toLocaleString()}</p>
              <p className="text-slate-500">Citations</p>
            </div>
            <div className="bg-white rounded-lg py-2">
              <p className="font-bold text-slate-900 text-base">{selected.works_count}</p>
              <p className="text-slate-500">Works</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="flex-1 text-sm bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 font-medium"
            >
              ✅ Apply stats to profile
            </button>
            <button
              onClick={handleImport}
              disabled={workStatus === "loading" || !works.length}
              className="flex-1 text-sm border border-indigo-300 text-indigo-700 py-2 rounded-lg hover:bg-indigo-100 disabled:opacity-50 font-medium"
            >
              {workStatus === "loading" ? <><Spinner />Loading…</> : `📚 Import ${works.length} works`}
            </button>
          </div>
        </div>
      )}

      {results.length === 0 && status === "ok" && (
        <p className="text-sm text-slate-500">No results. Try a different spelling or search term.</p>
      )}
    </div>
  );
}

// ─── CrossRef citation refresh (per-publication) ─────────────

export function CrossRefCitationBadge({ doi }: { doi: string }) {
  const [count, setCount]   = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");

  async function fetchCitations() {
    setStatus("loading");
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setCount(data.message?.["is-referenced-by-count"] ?? 0);
      setStatus("ok");
    } catch {
      setStatus("error");
    }
  }

  if (status === "idle") {
    return (
      <button
        onClick={fetchCitations}
        className="text-xs text-blue-600 border border-blue-200 bg-blue-50 rounded px-2 py-0.5 hover:bg-blue-100 transition-colors"
      >
        🔄 Live citations
      </button>
    );
  }
  if (status === "loading") return <span className="text-xs text-slate-400"><Spinner />Fetching…</span>;
  if (status === "error")   return <span className="text-xs text-red-500">Could not fetch</span>;
  return (
    <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded px-2 py-0.5 font-medium">
      📈 {count?.toLocaleString()} citations (live)
    </span>
  );
}

// ─── Main export ─────────────────────────────────────────────

export default function AcademicSync({ onUpdate }: { onUpdate: () => void }) {
  const profile = getMockProfile();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <h2 className="font-semibold text-slate-900">🔗 Live Academic Data</h2>
        <span className="text-xs text-slate-400">Real APIs — no mock</span>
      </div>
      <p className="text-xs text-slate-500 -mt-2">
        Search for your profile on Semantic Scholar or OpenAlex to import live h-index,
        citation count, and publication list. Google Scholar links only (no public API).
      </p>

      <SemanticScholarSection profile={profile} onUpdate={onUpdate} />
      <OpenAlexSection        profile={profile} onUpdate={onUpdate} />

      {/* Google Scholar — link only */}
      {profile.google_scholar_id && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span>🎓</span>
            <span className="text-sm font-medium text-slate-900">Google Scholar</span>
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">No public API</span>
          </div>
          <a
            href={`https://scholar.google.com/citations?user=${profile.google_scholar_id}`}
            target="_blank" rel="noopener"
            className="text-sm text-blue-600 hover:underline"
          >
            View profile ↗
          </a>
        </div>
      )}
    </div>
  );
}
