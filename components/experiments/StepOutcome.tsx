"use client";

import { useState } from "react";
import { ExperimentData } from "@/app/experiments/new/page";

type Props = {
  data: ExperimentData;
  updateData: (fields: Partial<ExperimentData>) => void;
  onNext: () => void;
  onBack: () => void;
};

const OUTCOME_OPTIONS = [
  {
    id: "success" as const,
    icon: "✅",
    label: "Success",
    desc: "The experiment worked as expected",
    color: "border-emerald-400 bg-emerald-50",
    activeRing: "ring-4 ring-emerald-100",
    badge: "bg-emerald-100 text-emerald-700",
  },
  {
    id: "partial" as const,
    icon: "⚠️",
    label: "Partial",
    desc: "The experiment partially worked — some useful data",
    color: "border-amber-400 bg-amber-50",
    activeRing: "ring-4 ring-amber-100",
    badge: "bg-amber-100 text-amber-700",
  },
  {
    id: "failed" as const,
    icon: "❌",
    label: "Failed",
    desc: "The experiment did not work — documenting for others",
    color: "border-red-400 bg-red-50",
    activeRing: "ring-4 ring-red-100",
    badge: "bg-red-100 text-red-700",
  },
];

const ROOT_CAUSE_SUGGESTIONS = [
  "Reagent quality / lot variability",
  "Buffer concentration error",
  "Temperature / incubation issue",
  "Equipment calibration",
  "Sample degradation",
  "Contamination",
  "Protocol deviation",
  "Cell passage number too high",
  "Antibody lot change",
  "Unknown — needs investigation",
];

export default function StepOutcome({ data, updateData, onNext, onBack }: Props) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!data.outcome) e.outcome = "Please mark the outcome";
    if (!data.outcomeSummary.trim()) e.summary = "A brief summary is required";
    if ((data.outcome === "failed" || data.outcome === "partial") && !data.failureContext.trim()) {
      e.failureContext = "Failure context is critical — it's the most valuable part for the community";
    }
    return e;
  }

  function handleNext() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onNext();
  }

  function toggleRootCause(cause: string) {
    const current = data.rootCause;
    if (current === cause) {
      updateData({ rootCause: "" });
    } else {
      updateData({ rootCause: cause });
    }
  }

  const showFailureFields = data.outcome === "failed" || data.outcome === "partial";

  return (
    <div className="space-y-6">
      {/* Outcome selection */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">
          Outcome <span className="text-blue-500">*</span>
        </p>
        <div className="grid grid-cols-3 gap-3">
          {OUTCOME_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { updateData({ outcome: opt.id }); setErrors((p) => ({ ...p, outcome: "" })); }}
              className={`border-2 rounded-xl p-4 text-center transition-all ${
                data.outcome === opt.id
                  ? `${opt.color} ${opt.activeRing}`
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="text-2xl mb-1">{opt.icon}</div>
              <div className="text-sm font-bold text-slate-900">{opt.label}</div>
              <div className="text-xs text-slate-500 mt-0.5 leading-snug">{opt.desc}</div>
            </button>
          ))}
        </div>
        {errors.outcome && <p className="text-xs text-red-500 mt-2">{errors.outcome}</p>}
      </div>

      {/* Negative result callout */}
      {showFailureFields && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-3">
          <span className="text-xl flex-shrink-0">⭐</span>
          <div className="text-sm text-amber-800">
            <strong>Negative results are first-class citizens.</strong> Documenting what didn&apos;t work saves others months of repeating the same failure. Your failure context is the most valuable part of this card.
          </div>
        </div>
      )}

      {/* Outcome summary */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Results Summary <span className="text-blue-500">*</span>
        </label>
        <textarea
          rows={3}
          placeholder={
            data.outcome === "success"
              ? "What were the key results? What worked? Include quantitative observations…"
              : data.outcome === "failed"
              ? "What happened? What did you observe that indicated failure? Include any measurements or signals you got…"
              : "What partially worked? What were the mixed results? Be specific about what succeeded and what failed…"
          }
          value={data.outcomeSummary}
          onChange={(e) => { updateData({ outcomeSummary: e.target.value }); setErrors((p) => ({ ...p, summary: "" })); }}
          className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors resize-none ${
            errors.summary
              ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
              : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
          }`}
        />
        {errors.summary && <p className="text-xs text-red-500 mt-1.5">{errors.summary}</p>}
      </div>

      {/* Failure context — shown for failed & partial */}
      {showFailureFields && (
        <>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Failure Context & What You Tried <span className="text-blue-500">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Describe exactly what you tried to fix the issue. What troubleshooting steps did you take? What changed between attempts? What did not help?"
              value={data.failureContext}
              onChange={(e) => { updateData({ failureContext: e.target.value }); setErrors((p) => ({ ...p, failureContext: "" })); }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors resize-none ${
                errors.failureContext
                  ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                  : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
              }`}
            />
            {errors.failureContext && <p className="text-xs text-red-500 mt-1.5">{errors.failureContext}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Suspected Root Cause <span className="text-slate-400 font-normal">(select one)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ROOT_CAUSE_SUGGESTIONS.map((cause) => (
                <button
                  key={cause}
                  type="button"
                  onClick={() => toggleRootCause(cause)}
                  className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                    data.rootCause === cause
                      ? "border-amber-500 bg-amber-500 text-white"
                      : "border-slate-200 text-slate-600 hover:border-amber-300 hover:bg-amber-50"
                  }`}
                >
                  {cause}
                </button>
              ))}
            </div>
            {data.rootCause && (
              <p className="text-xs text-slate-500 mt-2">
                Selected: <strong className="text-slate-700">{data.rootCause}</strong>
                <button
                  type="button"
                  onClick={() => updateData({ rootCause: "" })}
                  className="ml-2 text-slate-400 hover:text-slate-600"
                >
                  ✕ clear
                </button>
              </p>
            )}
          </div>
        </>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
          ← Back
        </button>
        <button type="button" onClick={handleNext} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          Continue to Files →
        </button>
      </div>
    </div>
  );
}
