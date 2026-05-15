"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NavBar from "@/components/NavBar";
import { saveProject, getUserPublications, MOCK_USER_ID, type Publication } from "@/lib/mock-db";

export default function NewProjectPage() {
  const router = useRouter();
  const [title, setTitle]           = useState("");
  const [description, setDesc]      = useState("");
  const [status, setStatus]         = useState<"active" | "completed" | "paused">("active");
  const [gitUrl, setGitUrl]         = useState("");
  const [tagsInput, setTagsInput]   = useState("");
  const [myPubs, setMyPubs]         = useState<Publication[]>([]);
  const [selectedPubs, setSelectedPubs] = useState<Set<string>>(new Set());
  const [pubSearch, setPubSearch]   = useState("");
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    setMyPubs(getUserPublications(MOCK_USER_ID));
  }, []);

  const filteredPubs = myPubs.filter((p) =>
    !pubSearch || p.title.toLowerCase().includes(pubSearch.toLowerCase())
  );

  function togglePub(id: string) {
    setSelectedPubs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
    const proj = saveProject({
      user_id: MOCK_USER_ID,
      title: title.trim(),
      description: description.trim(),
      status,
      git_url: gitUrl.trim() || null,
      publication_ids: Array.from(selectedPubs),
      collaborator_ids: [],
      tags,
    });
    router.push(`/projects/${proj.id}`);
  }

  const STATUS_OPTIONS: Array<{ value: "active" | "completed" | "paused"; label: string; color: string }> = [
    { value: "active",    label: "Active",    color: "bg-emerald-50 text-emerald-700 border-emerald-300" },
    { value: "completed", label: "Completed", color: "bg-blue-50 text-blue-700 border-blue-300" },
    { value: "paused",    label: "Paused",    color: "bg-slate-100 text-slate-600 border-slate-300" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/projects" className="text-slate-400 hover:text-slate-600 text-sm">← Projects</Link>
          <h1 className="text-xl font-bold text-slate-900">New Project</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Title */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Western Blot Optimisation Series"
              required
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
            />
          </div>

          {/* Description */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Description</label>
            <textarea
              value={description} onChange={(e) => setDesc(e.target.value)}
              rows={4}
              placeholder="What is this project about? What are the goals?"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 resize-none"
            />
          </div>

          {/* Status */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
            <div className="flex gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${status === opt.value ? opt.color : "bg-white text-slate-500 border-slate-200 hover:border-slate-400"}`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Git URL */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">🔗 Git Repository (optional)</label>
            <input
              value={gitUrl} onChange={(e) => setGitUrl(e.target.value)}
              placeholder="https://github.com/username/repo"
              type="url"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 font-mono"
            />
          </div>

          {/* Tags */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tags (comma-separated)</label>
            <input
              value={tagsInput} onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g. Western Blot, Proteomics, Methods"
              className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
            />
          </div>

          {/* Publications */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <label className="block text-sm font-semibold text-slate-700 mb-3">Add Publications</label>
            <div className="relative mb-3">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
              <input
                value={pubSearch} onChange={(e) => setPubSearch(e.target.value)}
                placeholder="Search your publications…"
                className="w-full border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            {myPubs.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-4">No publications yet. <Link href="/publications/new" className="text-blue-600 hover:underline">Add one first.</Link></p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredPubs.map((pub) => (
                  <label key={pub.id} className="flex items-start gap-3 cursor-pointer p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedPubs.has(pub.id)}
                      onChange={() => togglePub(pub.id)}
                      className="mt-0.5 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 line-clamp-1">{pub.title}</p>
                      <p className="text-xs text-slate-400">{pub.journal || "arXiv"} · {pub.year}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {selectedPubs.size > 0 && (
              <p className="text-xs text-blue-600 mt-2">{selectedPubs.size} publication{selectedPubs.size !== 1 ? "s" : ""} selected</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={!title.trim() || saving}
              className="flex-1 bg-blue-600 text-white font-semibold py-3 rounded-xl hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saving ? "Creating…" : "Create Project"}
            </button>
            <Link href="/projects"
              className="px-6 py-3 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
