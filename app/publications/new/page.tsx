"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { savePublication, getMockProfile } from "@/lib/mock-db";

const TYPES = ["paper", "preprint", "dataset", "code", "thesis"] as const;

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

          {/* DOI + arXiv */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">DOI</label>
              <input value={doi} onChange={(e) => setDoi(e.target.value)}
                placeholder="10.1038/s41586-xxx"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 font-mono" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">arXiv ID</label>
              <input value={arxivId} onChange={(e) => setArxivId(e.target.value)}
                placeholder="2401.12345"
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 font-mono" />
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
