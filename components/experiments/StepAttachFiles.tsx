"use client";

import { useState } from "react";
import { ExperimentData, AttachedFile } from "@/app/experiments/new/page";

type Props = {
  data: ExperimentData;
  updateData: (fields: Partial<ExperimentData>) => void;
  onNext: () => void;
  onBack: () => void;
};

const FILE_TYPE_ICONS: Record<string, string> = {
  image: "🖼️",
  data: "📊",
  notebook: "📓",
  code: "💻",
  document: "📄",
};

const SIMULATED_FILES: AttachedFile[] = [
  { name: "blot_scan_attempt3.tiff", type: "image", size: "4.2 MB" },
  { name: "raw_signal_data.csv", type: "data", size: "128 KB" },
  { name: "analysis_notebook.ipynb", type: "notebook", size: "1.1 MB" },
];

export default function StepAttachFiles({ data, updateData, onNext, onBack }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  function simulateUpload() {
    setUploading(true);
    setTimeout(() => {
      updateData({ attachedFiles: SIMULATED_FILES });
      setUploading(false);
    }, 1500);
  }

  function removeFile(idx: number) {
    updateData({ attachedFiles: data.attachedFiles.filter((_, i) => i !== idx) });
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600">
        All files are <strong className="text-slate-900">versioned automatically</strong> — every upload creates a new version linked to this experiment card. Raw data, images, and code become citable research artifacts.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); simulateUpload(); }}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
          dragOver
            ? "border-blue-400 bg-blue-50"
            : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100"
        }`}
        onClick={simulateUpload}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <svg className="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-sm text-slate-600">Uploading and versioning files…</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-3">📎</div>
            <p className="text-sm font-semibold text-slate-700">Drop files here or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">Images, CSV, TIFF, HDF5, Jupyter notebooks, R scripts — max 500MB per file</p>
            <button type="button" className="mt-4 text-sm text-blue-600 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors font-medium">
              Browse files
            </button>
          </>
        )}
      </div>

      {/* Attached files list */}
      {data.attachedFiles.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Attached files ({data.attachedFiles.length})</p>
          <div className="space-y-2">
            {data.attachedFiles.map((file, i) => (
              <div key={i} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white">
                <span className="text-xl">{FILE_TYPE_ICONS[file.type] || "📄"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{file.size} · versioned as v1.0</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5 font-medium">
                    ✓ Uploaded
                  </span>
                  <button type="button" onClick={() => removeFile(i)} className="text-slate-300 hover:text-red-400 text-lg leading-none transition-colors">×</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Code notebook link */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Code / Analysis Notebook URL <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <input
          type="url"
          placeholder="https://github.com/yourlab/repo or Jupyter nbviewer link"
          value={data.codeNotebookUrl}
          onChange={(e) => updateData({ codeNotebookUrl: e.target.value })}
          className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-colors"
        />
        <p className="text-xs text-slate-400 mt-1.5">Link to GitHub, GitLab, Binder, or any hosted notebook — code becomes a citable artifact</p>
      </div>

      {/* Integration hints */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: "🐙", name: "GitHub", desc: "Link a repo" },
          { icon: "🧫", name: "Benchling", desc: "Import ELN data" },
          { icon: "🔬", name: "protocols.io", desc: "Cite protocol" },
        ].map((int) => (
          <div key={int.name} className="border border-slate-200 rounded-xl p-3 text-center opacity-60 cursor-not-allowed">
            <div className="text-xl mb-1">{int.icon}</div>
            <div className="text-xs font-medium text-slate-700">{int.name}</div>
            <div className="text-xs text-slate-400">{int.desc}</div>
            <div className="text-xs text-slate-300 mt-1">Coming soon</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
          ← Back
        </button>
        <button type="button" onClick={onNext} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          Continue to Visibility →
        </button>
      </div>
    </div>
  );
}
