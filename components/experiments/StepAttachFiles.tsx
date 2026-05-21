"use client";

import { useRef } from "react";
import { ExperimentData } from "@/app/experiments/new/page";

type RealAttachment = { name: string; size: number; type: string; dataUrl: string };

type Props = {
  data: ExperimentData;
  updateData: (fields: Partial<ExperimentData>) => void;
  onNext: () => void;
  onBack: () => void;
};

function fileTypeIcon(type: string, name: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type === "application/pdf" || name.endsWith(".pdf")) return "📋";
  if (name.endsWith(".csv") || name.endsWith(".tsv")) return "📄";
  if (name.endsWith(".xlsx") || name.endsWith(".xls")) return "📊";
  if (name.endsWith(".zip") || name.endsWith(".gz") || name.endsWith(".tar")) return "📦";
  if (name.endsWith(".ipynb")) return "📓";
  if (name.endsWith(".py") || name.endsWith(".r") || name.endsWith(".R")) return "💻";
  return "📄";
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StepAttachFiles({ data, updateData, onNext, onBack }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachments: RealAttachment[] = (data as ExperimentData & { attachments?: RealAttachment[] }).attachments ?? [];

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const readers: Promise<RealAttachment>[] = Array.from(files).map(
      (file) =>
        new Promise<RealAttachment>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            resolve({
              name: file.name,
              size: file.size,
              type: file.type || "application/octet-stream",
              dataUrl: reader.result as string,
            });
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    );
    Promise.all(readers).then((newFiles) => {
      const merged = [...attachments, ...newFiles];
      (updateData as (fields: Record<string, unknown>) => void)({ attachments: merged });
    });
  }

  function removeFile(idx: number) {
    const next = attachments.filter((_, i) => i !== idx);
    (updateData as (fields: Record<string, unknown>) => void)({ attachments: next });
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600">
        All files are <strong className="text-slate-900">stored locally</strong> and attached to this experiment. Raw data, images, and code become citable research artifacts.
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50"
      >
        <div className="text-4xl mb-3">📎</div>
        <p className="text-sm font-semibold text-slate-700">Drop files here or click to browse</p>
        <p className="text-xs text-slate-400 mt-1">CSV, XLSX, PDF, PNG, JPG, ZIP — max 10 MB per file</p>
        <button
          type="button"
          className="mt-4 text-sm text-blue-600 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50 transition-colors font-medium"
        >
          Browse files
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv,.xlsx,.xls,.pdf,.png,.jpg,.jpeg,.tiff,.tif,.zip,.gz,.ipynb,.py,.r,.R,.tsv,.txt"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {/* Attached files list */}
      {attachments.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Attached files ({attachments.length})</p>
          <div className="space-y-2">
            {attachments.map((file, i) => (
              <div key={i} className="flex items-center gap-3 border border-slate-200 rounded-xl px-4 py-3 bg-white">
                <span className="text-xl">{fileTypeIcon(file.type, file.name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                  <p className="text-xs text-slate-400">{formatBytes(file.size)} · {file.type || "unknown"}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full px-2 py-0.5 font-medium">
                    ✓ Ready
                  </span>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    className="text-slate-300 hover:text-red-400 text-lg leading-none transition-colors"
                  >
                    ×
                  </button>
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
        <p className="text-xs text-slate-400 mt-1.5">
          Link to GitHub, GitLab, Binder, or any hosted notebook — code becomes a citable artifact
        </p>
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
