"use client";

import { useState } from "react";
import { ExperimentData, Reagent } from "@/app/experiments/new/page";

type Props = {
  data: ExperimentData;
  updateData: (fields: Partial<ExperimentData>) => void;
  onNext: () => void;
  onBack: () => void;
};

const TECHNIQUE_SUGGESTIONS = [
  "Western Blot", "PCR / qPCR", "CRISPR-Cas9", "Flow Cytometry",
  "RNA-seq", "ELISA", "Immunofluorescence", "Mass Spectrometry",
  "Confocal Microscopy", "Cell Culture", "Patch Clamp", "fMRI",
];

const ORGANISM_SUGGESTIONS = [
  "Human (HEK293)", "Human (HeLa)", "Mouse (C57BL/6)", "Rat",
  "E. coli", "S. cerevisiae", "Zebrafish", "Drosophila",
  "Primary neurons", "iPSC-derived", "Organoid", "In vitro",
];

export default function StepMethodCard({ data, updateData, onNext, onBack }: Props) {
  const [reagentInput, setReagentInput] = useState<Reagent>({ name: "", concentration: "", supplier: "" });
  const [customTag, setCustomTag] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  function validate() {
    const e: Record<string, string> = {};
    if (!data.methods.trim()) e.methods = "Methods / protocol is required";
    if (data.techniqueTags.length === 0) e.tags = "Add at least one technique tag";
    return e;
  }

  function handleNext() {
    const e = validate();
    if (Object.keys(e).length > 0) { setErrors(e); return; }
    onNext();
  }

  function addReagent() {
    if (!reagentInput.name.trim()) return;
    updateData({ reagents: [...data.reagents, { ...reagentInput }] });
    setReagentInput({ name: "", concentration: "", supplier: "" });
  }

  function removeReagent(idx: number) {
    updateData({ reagents: data.reagents.filter((_, i) => i !== idx) });
  }

  function toggleTag(tag: string, field: "techniqueTags" | "organismTags") {
    const current = data[field];
    if (current.includes(tag)) {
      updateData({ [field]: current.filter((t) => t !== tag) });
    } else {
      updateData({ [field]: [...current, tag] });
    }
    setErrors((p) => ({ ...p, tags: "" }));
  }

  function simulateAiTags() {
    setAiSuggesting(true);
    setTimeout(() => {
      const suggested = ["Western Blot", "HEK293"];
      updateData({
        techniqueTags: [...new Set([...data.techniqueTags, "Western Blot"])],
        organismTags: [...new Set([...data.organismTags, "Human (HEK293)"])],
      });
      setAiSuggesting(false);
      setAiSuggested(true);
    }, 1400);
  }

  return (
    <div className="space-y-6">
      {/* Title display */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-lg">🧪</span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium">Experiment</p>
          <p className="text-sm font-semibold text-slate-900 truncate">{data.title || "Untitled experiment"}</p>
        </div>
        <div className="ml-auto flex-shrink-0">
          <input
            type="text"
            value={data.protocolVersion}
            onChange={(e) => updateData({ protocolVersion: e.target.value })}
            className="border border-slate-200 rounded-lg px-2 py-1 text-xs font-mono w-16 text-center outline-none focus:border-blue-500 bg-white"
            placeholder="v1.0"
          />
          <p className="text-xs text-slate-400 text-center mt-0.5">Version</p>
        </div>
      </div>

      {/* Hypothesis */}
      <Field label="Hypothesis / Research Question">
        <textarea
          rows={2}
          placeholder="What were you testing or trying to achieve?"
          value={data.hypothesis}
          onChange={(e) => updateData({ hypothesis: e.target.value })}
          className={inputClass(false) + " resize-none"}
        />
      </Field>

      {/* Methods */}
      <Field label="Methods / Protocol" required error={errors.methods}>
        <textarea
          rows={5}
          placeholder="Describe the full experimental protocol step-by-step. Include equipment settings, incubation times, buffer compositions, and any deviations from standard procedures…"
          value={data.methods}
          onChange={(e) => { updateData({ methods: e.target.value }); setErrors((p) => ({ ...p, methods: "" })); }}
          className={inputClass(!!errors.methods) + " resize-none"}
        />
      </Field>

      {/* Conditions */}
      <Field label="Key Conditions">
        <input
          type="text"
          placeholder="e.g. pH 8.3, 37°C, 5% CO₂, transfer buffer 20% methanol, 90 min"
          value={data.conditions}
          onChange={(e) => updateData({ conditions: e.target.value })}
          className={inputClass(false)}
        />
        <p className="text-xs text-slate-400 mt-1.5">Critical variables that peers need to replicate your experiment</p>
      </Field>

      {/* Reagents */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">Reagents & Materials</label>
        {data.reagents.length > 0 && (
          <div className="mb-3 border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Reagent</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Conc.</th>
                  <th className="text-left px-3 py-2 font-semibold text-slate-600">Supplier</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {data.reagents.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0">
                    <td className="px-3 py-2 font-medium text-slate-900">{r.name}</td>
                    <td className="px-3 py-2 text-slate-600">{r.concentration || "—"}</td>
                    <td className="px-3 py-2 text-slate-600">{r.supplier || "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" onClick={() => removeReagent(i)} className="text-slate-300 hover:text-red-400 transition-colors text-base leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2 mb-2">
          <input
            type="text"
            placeholder="Reagent name *"
            value={reagentInput.name}
            onChange={(e) => setReagentInput((r) => ({ ...r, name: e.target.value }))}
            className={inputClass(false) + " col-span-1"}
          />
          <input
            type="text"
            placeholder="Concentration"
            value={reagentInput.concentration}
            onChange={(e) => setReagentInput((r) => ({ ...r, concentration: e.target.value }))}
            className={inputClass(false)}
          />
          <input
            type="text"
            placeholder="Supplier"
            value={reagentInput.supplier}
            onChange={(e) => setReagentInput((r) => ({ ...r, supplier: e.target.value }))}
            className={inputClass(false)}
          />
        </div>
        <button
          type="button"
          onClick={addReagent}
          disabled={!reagentInput.name.trim()}
          className="text-xs text-blue-600 border border-blue-200 rounded-lg px-3 py-1.5 hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + Add reagent
        </button>
      </div>

      {/* Tags */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-slate-700">
            Technique Tags <span className="text-blue-500">*</span>
          </label>
          <button
            type="button"
            onClick={simulateAiTags}
            disabled={aiSuggesting || aiSuggested}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
              aiSuggested
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-50 text-slate-600 border-slate-200 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            {aiSuggesting ? (
              <><span className="animate-spin inline-block w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full"></span> AI suggesting…</>
            ) : aiSuggested ? (
              "✓ AI tags applied"
            ) : (
              "✨ AI auto-suggest"
            )}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 mb-1">
          {TECHNIQUE_SUGGESTIONS.map((t) => {
            const sel = data.techniqueTags.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggleTag(t, "techniqueTags")}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  sel ? "border-blue-500 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                }`}>
                {t}
              </button>
            );
          })}
        </div>
        {errors.tags && <p className="text-xs text-red-500 mt-1">{errors.tags}</p>}
      </div>

      {/* Organism tags */}
      <div>
        <label className="text-sm font-medium text-slate-700 block mb-2">Organism / Model System</label>
        <div className="flex flex-wrap gap-2">
          {ORGANISM_SUGGESTIONS.map((t) => {
            const sel = data.organismTags.includes(t);
            return (
              <button key={t} type="button" onClick={() => toggleTag(t, "organismTags")}
                className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  sel ? "border-emerald-500 bg-emerald-600 text-white" : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                }`}>
                {t}
              </button>
            );
          })}
        </div>
      </div>

      <NavButtons onBack={onBack} onNext={handleNext} nextLabel="Continue to Outcome →" />
    </div>
  );
}

function Field({ label, required, error, children }: { label: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">
        {label}{required && <span className="text-blue-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
    </div>
  );
}

function NavButtons({ onBack, onNext, nextLabel }: { onBack: () => void; onNext: () => void; nextLabel: string }) {
  return (
    <div className="flex gap-3 pt-2">
      <button type="button" onClick={onBack} className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors">
        ← Back
      </button>
      <button type="button" onClick={onNext} className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
        {nextLabel}
      </button>
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full border rounded-lg px-3 py-2.5 text-sm outline-none transition-colors ${
    hasError
      ? "border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100"
      : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
  }`;
}
