"use client";

import { useState } from "react";
import { ExperimentData } from "@/app/experiments/new/page";

type Props = {
  data: ExperimentData;
  updateData: (fields: Partial<ExperimentData>) => void;
  onNext: () => void;
  onBack: () => void;
};

const VISIBILITY_OPTIONS = [
  {
    id: "lab" as const,
    icon: "🔒",
    label: "Lab only",
    desc: "Visible only to your lab workspace members. Ideal for work-in-progress.",
    badge: "Private",
    badgeStyle: "bg-slate-100 text-slate-600",
  },
  {
    id: "network" as const,
    icon: "🤝",
    label: "Collaborator network",
    desc: "Visible to your lab + trusted collaborator networks. Good for sharing early results.",
    badge: "Network",
    badgeStyle: "bg-blue-50 text-blue-700",
  },
  {
    id: "public" as const,
    icon: "🌐",
    label: "Public — SciCollab feed",
    desc: "Visible to all researchers on SciCollab. Earns maximum reputation and citation.",
    badge: "Public",
    badgeStyle: "bg-emerald-50 text-emerald-700",
  },
];

export default function StepVisibility({ data, updateData, onNext, onBack }: Props) {
  const [coAuthorInput, setCoAuthorInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const e: Record<string, string> = {};
    if (!data.visibility) e.visibility = "Please select a visibility setting";
    return e;
  }

  function handleNext() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onNext();
  }

  function addCoAuthor() {
    const email = coAuthorInput.trim();
    if (email && email.includes("@") && !data.coAuthors.includes(email)) {
      updateData({ coAuthors: [...data.coAuthors, email] });
      setCoAuthorInput("");
    }
  }

  return (
    <div className="space-y-6">
      {/* Visibility */}
      <div>
        <p className="text-sm font-medium text-slate-700 mb-3">
          Who can see this experiment? <span className="text-blue-500">*</span>
        </p>
        <div className="space-y-3">
          {VISIBILITY_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { updateData({ visibility: opt.id }); setErrors((p) => ({ ...p, visibility: "" })); }}
              className={`w-full flex items-center gap-4 border-2 rounded-xl px-5 py-4 text-left transition-all ${
                data.visibility === opt.id
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 hover:border-slate-300 bg-white"
              }`}
            >
              <span className="text-2xl flex-shrink-0">{opt.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 text-sm">{opt.label}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${opt.badgeStyle}`}>{opt.badge}</span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{opt.desc}</div>
              </div>
              {data.visibility === opt.id && (
                <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
        {errors.visibility && <p className="text-xs text-red-500 mt-2">{errors.visibility}</p>}
      </div>

      {/* Embargo */}
      {data.visibility === "public" && (
        <div className="p-4 border border-slate-200 rounded-xl bg-slate-50 space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Embargo until <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="date"
              value={data.embargoUntil}
              onChange={(e) => updateData({ embargoUntil: e.target.value })}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-colors bg-white"
            />
            <p className="text-xs text-slate-400 mt-1.5">Card is saved now but only published publicly after this date</p>
          </div>
        </div>
      )}

      {/* Co-authors */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          Co-authors & Contributors <span className="text-slate-400 font-normal">(optional)</span>
        </label>
        <div className="flex gap-2">
          <input
            type="email"
            placeholder="colleague@institution.edu"
            value={coAuthorInput}
            onChange={(e) => setCoAuthorInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCoAuthor())}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-colors"
          />
          <button
            type="button"
            onClick={addCoAuthor}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex-shrink-0"
          >
            Add
          </button>
        </div>
        {data.coAuthors.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {data.coAuthors.map((email) => (
              <span key={email} className="inline-flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs px-2.5 py-1 rounded-full border border-blue-100">
                {email}
                <button type="button" onClick={() => updateData({ coAuthors: data.coAuthors.filter((e) => e !== email) })} className="text-blue-400 hover:text-blue-700">×</button>
              </span>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1.5">Co-authors will be notified and credited on the published card</p>
      </div>

      {/* IP notice */}
      <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-xs text-amber-700">
        <strong>IP & ownership:</strong> You retain full ownership of your data. SciCollab stores it under a consent-by-design licence — you can set visibility, embargo, or delete at any time. GDPR compliant · EU data residency.
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
          ← Back
        </button>
        <button type="button" onClick={handleNext} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
          Review & Publish →
        </button>
      </div>
    </div>
  );
}
