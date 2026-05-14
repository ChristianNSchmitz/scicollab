"use client";

import { useState } from "react";
import { type Experiment, getProfile } from "@/lib/mock-db";

type Props = { experiment: Experiment; onClose: () => void };

type Format = "APA" | "BibTeX" | "MLA" | "Vancouver";

function buildCitation(exp: Experiment, format: Format): string {
  const author = getProfile(exp.user_id);
  const name   = author?.full_name ?? "Unknown Author";
  const year   = new Date(exp.created_at).getFullYear();
  const title  = exp.title;
  const url    = `https://scicollab.io/experiments/${exp.id}`;
  const shortId = exp.id.slice(0, 8);
  const version = exp.protocol_version;

  switch (format) {
    case "APA":
      return `${name} (${year}). ${title} [Method card, ${version}]. SciCollab. ${url}`;
    case "BibTeX":
      return `@misc{scicollab_${shortId},
  author    = {${name}},
  title     = {${title}},
  year      = {${year}},
  note      = {SciCollab method card, ${version}},
  url       = {${url}},
  howpublished = {\\url{${url}}}
}`;
    case "MLA":
      return `${name}. "${title}." SciCollab, ${year}, ${version}, ${url}.`;
    case "Vancouver":
      return `${name}. ${title} [Method card ${version}]. SciCollab; ${year}. Available from: ${url}`;
  }
}

export default function CiteModal({ experiment, onClose }: Props) {
  const [format, setFormat]   = useState<Format>("APA");
  const [copied, setCopied]   = useState(false);
  const citation = buildCitation(experiment, format);

  function copy() {
    navigator.clipboard.writeText(citation).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900">📝 Cite this method card</h2>
            <p className="text-xs text-slate-500 mt-0.5">Copy citation in your preferred format</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">✕</button>
        </div>

        <div className="px-6 py-5">
          {/* Format tabs */}
          <div className="flex gap-2 mb-4">
            {(["APA", "BibTeX", "MLA", "Vancouver"] as Format[]).map((f) => (
              <button key={f} onClick={() => setFormat(f)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${format === f ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>
                {f}
              </button>
            ))}
          </div>

          {/* Citation box */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-mono leading-relaxed">{citation}</pre>
          </div>

          {/* Experiment meta */}
          <div className="text-xs text-slate-400 mb-4 space-y-0.5">
            <p>ID: <span className="font-mono">{experiment.id}</span></p>
            <p>Version: <span className="font-mono">{experiment.protocol_version}</span></p>
            <p>Published: {new Date(experiment.created_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <button onClick={copy}
              className={`flex-1 text-sm font-semibold py-2.5 rounded-xl transition-colors ${copied ? "bg-emerald-500 text-white" : "bg-blue-600 text-white hover:bg-blue-700"}`}>
              {copied ? "✅ Copied!" : "📋 Copy citation"}
            </button>
            <button onClick={onClose}
              className="text-sm text-slate-500 border border-slate-200 px-4 py-2.5 rounded-xl hover:bg-slate-50">
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
