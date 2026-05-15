"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { savePublication, getMockProfile } from "@/lib/mock-db";

const TYPES = ["paper", "preprint", "dataset", "code", "thesis"] as const;

type LookupState = "idle" | "loading" | "ok" | "error";

export default function NewPublicationPage() {
  const router = useRouter();
  const [title, setTitle]       = useState("");
  const [abstract, setAbstract] = useState("");
  const [authors, setAuthors]   = useState("");
  const [journal, setJournal]   = useState("");
  const [year, setYear]         = useState(new Date().getFullYear().toString());
  const [doi, setDoi]           = useState("");
  const [arxivId, setArxivId]   = useState("");
  const [type, setType]         = useState<typeof TYPES[number]>("paper");
  const [tags, setTags]         = useState("");
  const [status, setStatus]     = useState<"published" | "preprint">("published");
  const [saving, setSaving]     = useState(false);

  const [doiLookup, setDoiLookup]     = useState<LookupState>("idle");
  const [arxivLookup, setArxivLookup] = useState<LookupState>("idle");

  async function handleDoiLookup() {
    if (!doi.trim()) return;
    setDoiLookup("loading");
    try {
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi.trim())}`);
      if (!res.ok) throw new Error("Not found");
      const data = await res.json();
      const msg = data.message;
      setTitle(msg.title?.[0] || title);
      setAuthors((msg.author ?? []).map((a: { given?: string; family?: string }) => `${a.given ? a.given[0] + "." : ""} ${a.family ?? ""}`.trim()).join(", "));
      setJournal(msg["container-title"]?.[0] || journal);
      const yr = msg.published?.["date-parts"]?.[0]?.[0];
      if (yr) setYear(String(yr));
      if (msg.abstract) setAbstract(msg.abstract.replace(/<[^>]+>/g, "").trim());
      setDoiLookup("ok");
    } catch {
      setDoiLookup("error");
    }
    setTimeout(() => setDoiLookup("idle"), 3000);
  }

  async function handleArxivLookup() {
    if (!arxivId.trim()) return;
    setArxivLookup("loading");
    try {
      const res = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(arxivId.trim())}`);
      if (!res.ok) throw new Error("Not found");
      const text = await res.text();
      const parser = new DOMParser();
      const xml = parser.parseFromString(text, "text/xml");
      const entry = xml.querySelector("entry");
      if (!entry) throw new Error("No entry");
      const titleEl = entry.querySelector("title");
      if (titleEl) setTitle(titleEl.textContent?.trim() || title);
      const summaryEl = entry.querySelector("summary");
      if (summaryEl) setAbstract(summaryEl.textContent?.trim() || abstract);
      const authorEls = entry.querySelectorAll("author name");
      if (authorEls.length > 0) {
        setAuthors(Array.from(authorEls).map((el) => {
          const parts = (el.textContent || "").trim().split(" ");
          const last = parts[parts.length - 1];
          const first = parts.length > 1 ? parts[0][0] + "." : "";
          return first ? `${first} ${last}` : last;
        }).join(", "));
      }
      const publishedEl = entry.querySelector("published");
      if (publishedEl) {
        const yr = new Date(publishedEl.textContent || "").getFullYear();
        if (!isNaN(yr)) setYear(String(yr));
      }
      setArxivLookup("ok");
    } catch {
      setArxivLookup("error");
    }
    setTimeout(() => setArxivLookup("idle"), 3000);
  }

  function lookupLabel(state: LookupState): string {
    if (state === "loading") return "⏳";
    if (state === "ok")      return "✅ Filled!";
    if (state === "error")   return "❌ Not found";
    return "🔍 Lookup";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const profile = getMockProfile();
    const pub = savePublication({
      user_id: profile.id,
      title: title.trim(),
      abstract: abstract.trim() || null,
      authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
      journal: journal.trim() || null,
      year: parseInt(year) || new Date().getFullYear(),
      doi: doi.trim() || null,
      arxiv_id: arxivId.trim() || null,
      type,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
      status,
    });
    router.push(`/publications/${pub.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Upload Publication</h1>
          <p className="text-sm text-slate-500 mt-1">Share your paper, preprint, dataset, or code with the community.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          {/* Type */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Type</label>
            <div className="flex flex-wrap gap-2">
              {TYPES.map((t) => {
                const icons = { paper: "📄", preprint: "📋", dataset: "🗄️", code: "💻", thesis: "🎓" };
                return (
                  <button key={t} type="button" onClick={() => setType(t)}
                    className={`text-sm px-3 py-2 rounded-lg font-medium transition-colors ${type === t ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                    {icons[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* DOI + arXiv with lookups */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">DOI</label>
              <div className="flex gap-2">
                <input value={doi} onChange={(e) => setDoi(e.target.value)}
                  placeholder="10.1038/s41586-xxx"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 font-mono min-w-0" />
                <button type="button" onClick={handleDoiLookup} disabled={!doi.trim() || doiLookup === "loading"}
                  className="text-xs font-medium px-2.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap flex-shrink-0">
                  {lookupLabel(doiLookup)}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">arXiv ID</label>
              <div className="flex gap-2">
                <input value={arxivId} onChange={(e) => setArxivId(e.target.value)}
                  placeholder="2401.12345"
                  className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 font-mono min-w-0" />
                <button type="button" onClick={handleArxivLookup} disabled={!arxivId.trim() || arxivLookup === "loading"}
                  className="text-xs font-medium px-2.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap flex-shrink-0">
                  {lookupLabel(arxivLookup)}
                </button>
              </div>
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder="Full publication title"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
          </div>

          {/* Authors */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Authors (comma-separated)</label>
            <input value={authors} onChange={(e) => setAuthors(e.target.value)}
              placeholder="J. Smith, A. Jones, M. Chen"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
          </div>

          {/* Abstract */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Abstract</label>
            <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={5}
              placeholder="Paste your abstract here…"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 resize-none" />
          </div>

          {/* Journal + Year */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Journal / Venue</label>
              <input value={journal} onChange={(e) => setJournal(e.target.value)}
                placeholder="Nature, Cell, bioRxiv…"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Year</label>
              <input value={year} onChange={(e) => setYear(e.target.value)} type="number" min="1900" max="2030"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Tags (comma-separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="Western Blot, Proteomics, Methods"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Publication status</label>
            <div className="flex gap-3">
              {(["published", "preprint"] as const).map((s) => (
                <button key={s} type="button" onClick={() => setStatus(s)}
                  className={`text-sm px-4 py-2 rounded-xl font-medium border transition-colors ${status === s ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                  {s === "published" ? "✅ Published" : "📋 Preprint"}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={!title.trim() || saving}
              className="flex-1 bg-blue-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? "Uploading…" : "📤 Upload publication"}
            </button>
            <button type="button" onClick={() => router.back()}
              className="text-sm text-slate-500 border border-slate-200 px-4 rounded-xl hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
