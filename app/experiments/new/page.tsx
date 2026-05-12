"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveExperiment, getMockProfile } from "@/lib/mock-db";
import StepInitiate from "@/components/experiments/StepInitiate";
import StepMethodCard from "@/components/experiments/StepMethodCard";
import StepOutcome from "@/components/experiments/StepOutcome";
import StepAttachFiles from "@/components/experiments/StepAttachFiles";
import StepVisibility from "@/components/experiments/StepVisibility";
import StepPublish from "@/components/experiments/StepPublish";

export type Reagent = {
  name: string;
  concentration: string;
  supplier: string;
};

export type AttachedFile = {
  name: string;
  type: string;
  size: string;
};

export type ExperimentData = {
  importMethod: "fresh" | "csv" | "notebook" | "";
  title: string;
  protocolVersion: string;
  hypothesis: string;
  methods: string;
  conditions: string;
  reagents: Reagent[];
  techniqueTags: string[];
  organismTags: string[];
  outcome: "success" | "partial" | "failed" | "";
  outcomeSummary: string;
  failureContext: string;
  rootCause: string;
  attachedFiles: AttachedFile[];
  codeNotebookUrl: string;
  visibility: "lab" | "network" | "public";
  embargoUntil: string;
  coAuthors: string[];
};

const INITIAL_DATA: ExperimentData = {
  importMethod: "",
  title: "",
  protocolVersion: "v1.0",
  hypothesis: "",
  methods: "",
  conditions: "",
  reagents: [],
  techniqueTags: [],
  organismTags: [],
  outcome: "",
  outcomeSummary: "",
  failureContext: "",
  rootCause: "",
  attachedFiles: [],
  codeNotebookUrl: "",
  visibility: "lab",
  embargoUntil: "",
  coAuthors: [],
};

const STEPS = [
  { num: 1, label: "Initiate", icon: "🚀" },
  { num: 2, label: "Method Card", icon: "🧪" },
  { num: 3, label: "Outcome", icon: "📊" },
  { num: 4, label: "Files", icon: "📎" },
  { num: 5, label: "Visibility", icon: "👁" },
  { num: 6, label: "Publish", icon: "✅" },
];

export default function NewExperimentPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<ExperimentData>(INITIAL_DATA);
  const [publishError, setPublishError] = useState("");

  function updateData(fields: Partial<ExperimentData>) {
    setData((prev) => ({ ...prev, ...fields }));
  }

  function next() {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
      window.scrollTo(0, 0);
    }
  }

  function back() {
    if (currentStep > 0) {
      setCurrentStep((s) => s - 1);
      window.scrollTo(0, 0);
    }
  }

  async function handlePublish() {
    setPublishError("");
    const profile = getMockProfile();

    const experiment = saveExperiment({
      user_id:          profile.id,
      parent_id:        null,
      title:            data.title,
      protocol_version: data.protocolVersion,
      hypothesis:       data.hypothesis || null,
      methods:          data.methods || null,
      conditions:       data.conditions || null,
      reagents:         data.reagents,
      technique_tags:   data.techniqueTags,
      organism_tags:    data.organismTags,
      outcome:          (data.outcome || null) as "success" | "partial" | "failed" | null,
      outcome_summary:  data.outcomeSummary || null,
      failure_context:  data.failureContext || null,
      root_cause:       data.rootCause || null,
      attached_files:   data.attachedFiles,
      code_notebook_url: data.codeNotebookUrl || null,
      visibility:       data.visibility,
      co_authors:       data.coAuthors,
    });

    router.push(`/experiments/${experiment.id}`);
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-xl font-bold text-blue-600">SciCollab</Link>
            <span className="text-slate-300">/</span>
            <span className="text-sm text-slate-500">New Experiment</span>
          </div>
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            ✕ Cancel
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Step progress */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex items-center min-w-max mx-auto">
            {STEPS.map((step, idx) => (
              <div key={step.num} className="flex items-center">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      idx < currentStep
                        ? "bg-blue-600 text-white"
                        : idx === currentStep
                        ? "bg-blue-600 text-white ring-4 ring-blue-100"
                        : "bg-white border-2 border-slate-200 text-slate-400"
                    }`}
                  >
                    {idx < currentStep ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.icon
                    )}
                  </div>
                  <span className={`text-xs mt-1 font-medium ${idx <= currentStep ? "text-blue-600" : "text-slate-400"}`}>
                    {step.label}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className="w-10 h-0.5 mx-1 mt-[-14px] transition-colors duration-400"
                    style={{ backgroundColor: idx < currentStep ? "#2563eb" : "#e2e8f0" }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-8 py-5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-0.5">
                Step {currentStep + 1} of {STEPS.length}
              </div>
              <h1 className="text-lg font-bold text-slate-900">
                {currentStep === 0 && "Start your experiment card"}
                {currentStep === 1 && "Fill in the method card"}
                {currentStep === 2 && "Define the outcome"}
                {currentStep === 3 && "Attach raw files & data"}
                {currentStep === 4 && "Set visibility & attribution"}
                {currentStep === 5 && "Review & publish"}
              </h1>
            </div>
            {data.outcome && <OutcomeBadge outcome={data.outcome} />}
          </div>

          <div className="px-8 py-8">
            {currentStep === 0 && <StepInitiate data={data} updateData={updateData} onNext={next} />}
            {currentStep === 1 && <StepMethodCard data={data} updateData={updateData} onNext={next} onBack={back} />}
            {currentStep === 2 && <StepOutcome data={data} updateData={updateData} onNext={next} onBack={back} />}
            {currentStep === 3 && <StepAttachFiles data={data} updateData={updateData} onNext={next} onBack={back} />}
            {currentStep === 4 && <StepVisibility data={data} updateData={updateData} onNext={next} onBack={back} />}
            {currentStep === 5 && (
              <StepPublish
                data={data}
                onPublish={handlePublish}
                onBack={back}
                publishError={publishError}
              />
            )}
          </div>
        </div>

        <p className="text-xs text-slate-400 mt-4 text-center">
          ★ Negative results are first-class citizens — not an afterthought.
        </p>
      </div>
    </div>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const styles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    partial: "bg-amber-50 text-amber-700 border-amber-200",
    failed: "bg-red-50 text-red-700 border-red-200",
  };
  const labels: Record<string, string> = {
    success: "✓ Success",
    partial: "~ Partial",
    failed: "✕ Failed",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${styles[outcome]}`}>
      {labels[outcome]}
    </span>
  );
}
