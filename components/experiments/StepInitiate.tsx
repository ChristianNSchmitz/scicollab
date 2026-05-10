"use client";

import { useState } from "react";
import { ExperimentData } from "@/app/experiments/new/page";

type Props = {
  data: ExperimentData;
  updateData: (fields: Partial<ExperimentData>) => void;
  onNext: () => void;
};

const IMPORT_OPTIONS = [
  {
    id: "fresh" as const,
    icon: "✏️",
    title: "Start fresh",
    desc: "Fill in the method card manually from scratch",
  },
  {
    id: "csv" as const,
    icon: "📄",
    title: "Import from CSV / spreadsheet",
    desc: "Upload a structured data file — we'll pre-fill the fields",
  },
  {
    id: "notebook" as const,
    icon: "📓",
    title: "Import from lab notebook",
    desc: "Paste from Benchling, protocols.io, or any ELN export",
  },
];

export default function StepInitiate({ data, updateData, onNext }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!data.importMethod) e.importMethod = "Choose how you want to start";
    if (!data.title.trim()) e.title = "Experiment title is required";
    return e;
  }

  function handleNext() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onNext();
  }

  return (
    <div className="space-y-6">
      {/* Import method */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">
          How do you want to start? <span className="text-blue-500">*</span>
        </p>
        <div className="space-y-3">
          {IMPORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { updateData({ importMethod: opt.id }); setErrors((p) => ({ ...p, importMethod: "" })); }}
              className={`w-full flex items-center gap-4 border-2 rounded-xl px-5 py-4 text-left transition-all ${
                data.importMethod === opt.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <span className="text-2xl flex-shrink-0">{opt.icon}</span>
              <div>
                <div className="font-semibold text-slate-900 text-sm">{opt.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
              </div>
              {data.importMethod === opt.id && (
                <div className="ml-auto w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
        {errors.importMethod && <p className="text-xs text-red-500 mt-2">{errors.importMethod}</p>}
      </div>

      {/* CSV upload hint */}
      {data.importMethod === "csv" && (
        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center bg-slate-50">
          <div className="text-3xl mb-2">📄</div>
          <p className="text-sm font-medium text-slate-700">Drop your CSV here or click to browse</p>
          <p className="text-xs text-slate-400 mt-1">Supports .csv, .xlsx, .tsv — max 10MB</p>
          <button type="button" className="mt-3 text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors">
            Browse files
          </button>
        </div>
      )}

      {data.importMethod === "notebook" && (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
          <p className="text-sm font-medium text-slate-700 mb-2">Paste your ELN export</p>
          <textarea
            rows={5}
            placeholder="Paste content from Benchling, protocols.io, or any lab notebook export…"
            className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-colors resize-none bg-white"
          />
        </div>
      )}

      {/* Experiment title */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Experiment Title <span className="text-blue-500">*</span>
        </label>
        <input
          type="text"
          placeholder="e.g. Western Blot Optimisation — HEK293 Low Signal, pH 8.3 Buffer"
          value={data.title}
          onChange={(e) => { updateData({ title: e.target.value }); setErrors((p) => ({ ...p, title: "" })); }}
          className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors ${
            errors.title
              ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
              : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
          }`}
        />
        {errors.title
          ? <p className="text-xs text-red-500 mt-1.5">{errors.title}</p>
          : <p className="text-xs text-slate-400 mt-1.5">Be specific — this is what peers will search for</p>
        }
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        <strong>Tip:</strong> The more detail you add, the more useful your card is for the global research community — and the more reputation you earn.
      </div>

      <button
        type="button"
        onClick={handleNext}
        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
      >
        Continue to Method Card →
      </button>
    </div>
  );
}
