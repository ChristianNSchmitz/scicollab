"use client";

import { useState } from "react";
import { ExperimentData } from "@/app/experiments/new/page";

type Props = {
  data: ExperimentData;
  onPublish: () => Promise<void>;
  onBack: () => void;
  publishError?: string;
};

export default function StepPublish({ data, onPublish, onBack, publishError }: Props) {
  const [publishing, setPublishing] = useState(false);

  async function handlePublish() {
    setPublishing(true);
    try {
      await onPublish();
    } finally {
      setPublishing(false);
    }
  }

  const outcomeStyles: Record<string, { border: string; bg: string; text: string; label: string }> = {
    success: { border: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", label: "✅ Success" },
    partial: { border: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", label: "⚠️ Partial" },
    failed: { border: "border-red-300", bg: "bg-red-50", text: "text-red-700", label: "❌ Failed — documented" },
  };
  const style = data.outcome ? outcomeStyles[data.outcome] : outcomeStyles.success;

  const visibilityLabel: Record<string, string> = {
    lab: "🔒 Lab only",
    network: "🤝 Collaborator network",
    public: "🌐 Public — SciCollab feed",
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
        Review your method card before publishing. Once published, it enters the <strong>searchable knowledge graph</strong> and co-authors are notified.
      </div>

      {/* Method card preview */}
      <div className={`border-2 ${style.border} rounded-2xl overflow-hidden`}>
        <div className={`${style.bg} px-6 py-4 border-b ${style.border}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${style.border} ${style.bg} ${style.text}`}>
                  {style.label}
                </span>
                <span className="text-xs text-slate-400 font-mono">{data.protocolVersion}</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 leading-snug">
                {data.title || "Untitled experiment"}
              </h2>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4 bg-white">
          {data.hypothesis && (
            <Section title="Hypothesis">
              <p className="text-sm text-slate-700">{data.hypothesis}</p>
            </Section>
          )}

          {data.methods && (
            <Section title="Protocol / Methods">
              <p className="text-sm text-slate-700 whitespace-pre-line line-clamp-4">{data.methods}</p>
            </Section>
          )}

          {data.conditions && (
            <Section title="Key Conditions">
              <p className="text-sm text-slate-600 font-mono text-xs bg-slate-50 rounded-lg px-3 py-2">{data.conditions}</p>
            </Section>
          )}

          {data.reagents.length > 0 && (
            <Section title={`Reagents (${data.reagents.length})`}>
              <div className="flex flex-wrap gap-1.5">
                {data.reagents.map((r, i) => (
                  <span key={i} className="text-xs bg-slate-100 text-slate-700 rounded-lg px-2 py-1">
                    {r.name}{r.concentration ? ` · ${r.concentration}` : ""}
                  </span>
                ))}
              </div>
            </Section>
          )}

          {data.outcomeSummary && (
            <Section title="Results Summary">
              <p className="text-sm text-slate-700">{data.outcomeSummary}</p>
            </Section>
          )}

          {data.failureContext && (
            <Section title="Failure Context & Troubleshooting">
              <p className="text-sm text-slate-700">{data.failureContext}</p>
              {data.rootCause && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-slate-500">Suspected root cause:</span>
                  <span className="text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">{data.rootCause}</span>
                </div>
              )}
            </Section>
          )}

          {(data.techniqueTags.length > 0 || data.organismTags.length > 0) && (
            <div className="flex flex-wrap gap-1.5 pt-1 border-t border-slate-100">
              {data.techniqueTags.map((t) => (
                <span key={t} className="text-xs bg-blue-50 text-blue-700 rounded-full px-2.5 py-0.5 border border-blue-100">{t}</span>
              ))}
              {data.organismTags.map((t) => (
                <span key={t} className="text-xs bg-emerald-50 text-emerald-700 rounded-full px-2.5 py-0.5 border border-emerald-100">{t}</span>
              ))}
            </div>
          )}

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 text-xs text-slate-500">
              {data.attachedFiles.length > 0 && (
                <span>📎 {data.attachedFiles.length} file{data.attachedFiles.length !== 1 ? "s" : ""} attached</span>
              )}
              {data.codeNotebookUrl && <span>💻 Code linked</span>}
              {data.coAuthors.length > 0 && <span>👥 {data.coAuthors.length} co-author{data.coAuthors.length !== 1 ? "s" : ""}</span>}
            </div>
            <span className="text-xs text-slate-500">{visibilityLabel[data.visibility]}</span>
          </div>
        </div>
      </div>

      {publishError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {publishError}
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack} disabled={publishing} className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl font-semibold hover:bg-slate-50 transition-colors disabled:opacity-50">
          ← Back
        </button>
        <button
          type="button"
          onClick={handlePublish}
          disabled={publishing}
          className="flex-[2] bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {publishing ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Publishing to knowledge graph…
            </>
          ) : (
            "🚀 Publish Method Card"
          )}
        </button>
      </div>

      {!publishing && (
        <p className="text-xs text-slate-400 text-center">
          Co-authors will be notified · Card enters the searchable knowledge graph · You can edit or delete at any time
        </p>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">{title}</p>
      {children}
    </div>
  );
}
