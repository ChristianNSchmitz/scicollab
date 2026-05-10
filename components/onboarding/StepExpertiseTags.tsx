"use client";

import { useState } from "react";
import { OnboardingData } from "@/app/onboarding/page";

type Props = {
  data: OnboardingData;
  updateData: (fields: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
};

const RESEARCH_DOMAINS = [
  "Biology & Life Sciences",
  "Neuroscience",
  "Chemistry",
  "Biochemistry",
  "Physics",
  "Engineering",
  "Computer Science / Bioinformatics",
  "Medicine & Clinical Research",
  "Environmental Science",
  "Materials Science",
  "Other",
];

const SUBFIELD_MAP: Record<string, string[]> = {
  "Biology & Life Sciences": [
    "Molecular Biology", "Cell Biology", "Genetics", "Developmental Biology",
    "Immunology", "Microbiology", "Proteomics", "Genomics", "Structural Biology",
  ],
  "Neuroscience": [
    "Cognitive Neuroscience", "Systems Neuroscience", "Computational Neuroscience",
    "Neuroimaging (fMRI/EEG)", "Electrophysiology", "Neuropsychology",
    "Optogenetics", "Connectomics",
  ],
  "Chemistry": [
    "Organic Chemistry", "Inorganic Chemistry", "Analytical Chemistry",
    "Physical Chemistry", "Medicinal Chemistry", "Catalysis", "Spectroscopy",
  ],
  "Biochemistry": [
    "Enzymology", "Metabolomics", "Lipidomics", "Epigenetics", "Signal Transduction",
  ],
  "Physics": [
    "Condensed Matter", "Quantum Physics", "Optics", "High Energy Physics",
    "Astrophysics", "Soft Matter",
  ],
  "Engineering": [
    "Biomedical Engineering", "Chemical Engineering", "Mechanical Engineering",
    "Electrical Engineering", "Nanoengineering",
  ],
  "Computer Science / Bioinformatics": [
    "Machine Learning / AI", "Bioinformatics", "Computational Biology",
    "Data Science", "Scientific Computing", "HPC",
  ],
  "Medicine & Clinical Research": [
    "Clinical Trials", "Epidemiology", "Pharmacology", "Radiology",
    "Oncology", "Psychiatry",
  ],
  "Environmental Science": [
    "Ecology", "Climate Science", "Oceanography", "Geoscience",
  ],
  "Materials Science": [
    "Nanomaterials", "Polymers", "Semiconductors", "Biomaterials",
  ],
  "Other": [],
};

const TECHNIQUE_OPTIONS = [
  "Western Blot", "PCR / qPCR", "CRISPR-Cas9", "Flow Cytometry",
  "Immunofluorescence", "RNA-seq", "ChIP-seq", "ELISA",
  "Mass Spectrometry", "NMR Spectroscopy", "Patch Clamp",
  "fMRI", "Single-cell RNA-seq", "Protein Crystallography",
  "Cell Culture", "Animal Models", "Organoids", "Confocal Microscopy",
  "ATAC-seq", "Hi-C", "HPC / Cluster Computing", "Python / R Analysis",
];

export default function StepExpertiseTags({ data, updateData, onNext, onBack }: Props) {
  const [customTechnique, setCustomTechnique] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const availableSubfields = data.researchDomain ? (SUBFIELD_MAP[data.researchDomain] || []) : [];

  function toggleSubfield(sf: string) {
    const current = data.subfields;
    if (current.includes(sf)) {
      updateData({ subfields: current.filter((s) => s !== sf) });
    } else if (current.length < 5) {
      updateData({ subfields: [...current, sf] });
    }
  }

  function toggleTechnique(t: string) {
    const current = data.techniques;
    if (current.includes(t)) {
      updateData({ techniques: current.filter((x) => x !== t) });
    } else if (current.length < 10) {
      updateData({ techniques: [...current, t] });
    }
  }

  function addCustomTechnique() {
    const t = customTechnique.trim();
    if (t && !data.techniques.includes(t) && data.techniques.length < 10) {
      updateData({ techniques: [...data.techniques, t] });
      setCustomTechnique("");
    }
  }

  function validate() {
    const e: Record<string, string> = {};
    if (!data.researchDomain) e.domain = "Please select a research domain";
    if (data.techniques.length === 0) e.techniques = "Add at least one technique to enable peer-matching";
    return e;
  }

  function handleNext() {
    const e = validate();
    if (Object.keys(e).length > 0) {
      setErrors(e);
      return;
    }
    onNext();
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        <strong>Why this matters:</strong> Your expertise tags power peer-matching — when a researcher asks a question matching your techniques, you&apos;ll get notified. The more specific, the better your matches.
      </div>

      {/* Research Domain */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Research Domain <span className="text-blue-500">*</span>
        </label>
        <select
          value={data.researchDomain}
          onChange={(e) => {
            updateData({ researchDomain: e.target.value, subfields: [] });
            setErrors(prev => ({ ...prev, domain: "" }));
          }}
          className={`w-full border rounded-lg px-3 py-2.5 text-sm outline-none bg-white transition-colors ${
            errors.domain
              ? "border-red-300 focus:border-red-500"
              : "border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
          }`}
        >
          <option value="">Select your primary research domain…</option>
          {RESEARCH_DOMAINS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        {errors.domain && <p className="text-xs text-red-500 mt-1.5">{errors.domain}</p>}
      </div>

      {/* Subfields */}
      {availableSubfields.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Sub-fields{" "}
            <span className="text-slate-400 font-normal">(select up to 5)</span>
          </label>
          <div className="flex flex-wrap gap-2 mt-2">
            {availableSubfields.map((sf) => {
              const selected = data.subfields.includes(sf);
              const maxed = data.subfields.length >= 5 && !selected;
              return (
                <button
                  key={sf}
                  type="button"
                  onClick={() => toggleSubfield(sf)}
                  disabled={maxed}
                  className={`expertise-tag text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                    selected
                      ? "border-blue-500 bg-blue-600 text-white"
                      : maxed
                      ? "border-slate-200 text-slate-300 cursor-not-allowed"
                      : "border-slate-200 text-slate-600 hover:border-blue-300 hover:bg-blue-50"
                  }`}
                >
                  {sf}
                </button>
              );
            })}
          </div>
          {data.subfields.length > 0 && (
            <p className="text-xs text-slate-400 mt-1.5">{data.subfields.length}/5 selected</p>
          )}
        </div>
      )}

      {/* Techniques */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Techniques & Methods <span className="text-blue-500">*</span>{" "}
          <span className="text-slate-400 font-normal">(select up to 10)</span>
        </label>
        <p className="text-xs text-slate-500 mb-2">These are the techniques you can answer questions about</p>
        <div className="flex flex-wrap gap-2">
          {TECHNIQUE_OPTIONS.map((t) => {
            const selected = data.techniques.includes(t);
            const maxed = data.techniques.length >= 10 && !selected;
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleTechnique(t)}
                disabled={maxed}
                className={`expertise-tag text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                  selected
                    ? "border-emerald-500 bg-emerald-600 text-white"
                    : maxed
                    ? "border-slate-200 text-slate-300 cursor-not-allowed"
                    : "border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50"
                }`}
              >
                {t}
              </button>
            );
          })}
        </div>
        {errors.techniques && <p className="text-xs text-red-500 mt-2">{errors.techniques}</p>}

        {/* Custom technique */}
        <div className="flex gap-2 mt-3">
          <input
            type="text"
            placeholder="Add a custom technique…"
            value={customTechnique}
            onChange={(e) => setCustomTechnique(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCustomTechnique())}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50 transition-colors"
          />
          <button
            type="button"
            onClick={addCustomTechnique}
            disabled={data.techniques.length >= 10}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors flex-shrink-0 disabled:opacity-40"
          >
            Add
          </button>
        </div>
        {data.techniques.length > 0 && (
          <p className="text-xs text-slate-400 mt-1.5">{data.techniques.length}/10 selected</p>
        )}
      </div>

      {/* Summary preview */}
      {(data.researchDomain || data.techniques.length > 0) && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Your expertise profile preview</p>
          {data.researchDomain && (
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-slate-500">Domain:</span>
              <span className="text-xs font-medium text-slate-900">{data.researchDomain}</span>
            </div>
          )}
          {data.subfields.length > 0 && (
            <div className="flex items-start gap-2 mb-2">
              <span className="text-xs text-slate-500 flex-shrink-0">Sub-fields:</span>
              <span className="text-xs text-slate-700">{data.subfields.join(", ")}</span>
            </div>
          )}
          {data.techniques.length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-xs text-slate-500 flex-shrink-0">Techniques:</span>
              <span className="text-xs text-slate-700">{data.techniques.join(", ")}</span>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors"
        >
          ← Back
        </button>
        <button
          type="button"
          onClick={handleNext}
          className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
        >
          Continue to Notifications →
        </button>
      </div>
    </div>
  );
}
