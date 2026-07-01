"use client";

import { useState } from "react";
import { searchScholarAuthors, importScholarData, type ScholarAuthor } from "@/lib/scholar";
import { toast } from "@/lib/toast";

/**
 * Search OpenAlex for an author and import their real h-index, citation
 * count, and top publications into the current profile.
 */
export default function ScholarImport({ defaultQuery = "", onImported }: {
  defaultQuery?: string;
  onImported?: () => void;
}) {
  const [query, setQuery]       = useState(defaultQuery);
  const [results, setResults]   = useState<ScholarAuthor[]>([]);
  const [searching, setSearching] = useState(false);
  const [importingId, setImportingId] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      setResults(await searchScholarAuthors(query.trim()));
    } catch {
      toast("Couldn't reach OpenAlex — check your connection", "error");
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleImport(author: ScholarAuthor) {
    setImportingId(author.id);
    try {
      const n = await importScholarData(author);
      toast(`Imported metrics + ${n} publication${n === 1 ? "" : "s"} from OpenAlex`);
      onImported?.();
    } catch {
      toast("Import failed — please try again", "error");
    } finally {
      setImportingId(null);
    }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
      <div>
        <h2 className="font-semibold text-slate-900 text-lg">Import scholarly metadata</h2>
        <p className="text-sm text-slate-500 mt-1">
          Pull your real h-index, citation count, and publications from{" "}
          <a href="https://openalex.org" target="_blank" rel="noopener" className="text-blue-600 hover:underline">OpenAlex</a>.
        </p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search your name, e.g. Christian Nikolaus Schmitz"
          className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
        />
        <button type="submit" disabled={searching || !query.trim()}
          className="bg-slate-800 text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-slate-900 transition-colors disabled:opacity-50 whitespace-nowrap">
          {searching ? "Searching…" : "Search"}
        </button>
      </form>

      {searched && !searching && results.length === 0 && (
        <p className="text-sm text-slate-400">No authors found. Try adding your institution or using your published name.</p>
      )}

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((a) => (
            <div key={a.id} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 hover:border-blue-200 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-900 truncate">{a.display_name}</p>
                <p className="text-xs text-slate-500 truncate">{a.institution ?? "Unknown institution"}</p>
                <div className="flex gap-3 mt-1 text-xs text-slate-400">
                  <span><b className="text-slate-600">{a.works_count}</b> works</span>
                  <span><b className="text-slate-600">{a.cited_by_count.toLocaleString()}</b> citations</span>
                  <span>h-index <b className="text-slate-600">{a.h_index}</b></span>
                </div>
              </div>
              <button
                onClick={() => handleImport(a)}
                disabled={importingId !== null}
                className="bg-blue-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 whitespace-nowrap">
                {importingId === a.id ? "Importing…" : "Import"}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
