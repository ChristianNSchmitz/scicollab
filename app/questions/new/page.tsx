"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import NavBar from "@/components/NavBar";
import { saveStandaloneQuestion } from "@/lib/mock-db";

export default function NewQuestionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody]   = useState("");
  const [tags, setTags]   = useState("");
  const [saving, setSaving] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const q = saveStandaloneQuestion(title.trim(), body.trim(), tags.split(",").map((t) => t.trim()).filter(Boolean));
    router.push(`/questions/${q.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Ask a Question</h1>
        <p className="text-sm text-slate-500 mb-6">Get help from researchers with matching expertise. Be specific for better answers.</p>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required
              placeholder="e.g. Best approach for single-cell RNA-seq on frozen tissue samples?"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
            <p className="text-xs text-slate-400 mt-1">Be specific. Imagine you&apos;re asking a colleague at a conference.</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Body</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={8}
              placeholder="Describe your problem in detail. Include what you've already tried, your experimental conditions, and what you expect vs. what's happening..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 resize-none" />
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Tags (comma-separated)</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)}
              placeholder="RNA-seq, Nuclei Isolation, Single-cell"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50" />
            <p className="text-xs text-slate-400 mt-1">Tags help route your question to the right experts.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={!title.trim() || saving}
              className="flex-1 bg-blue-600 text-white text-sm font-semibold py-3 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50">
              {saving ? "Posting…" : "💬 Post question"}
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
