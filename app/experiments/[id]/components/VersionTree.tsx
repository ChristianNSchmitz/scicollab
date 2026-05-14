"use client";

import Link from "next/link";
import { getExperiment, getForks, getProfile, type Experiment } from "@/lib/mock-db";

function timeAgo(d: string) {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
  if (days === 0) return "today";
  if (days < 30) return `${days}d ago`;
  return new Date(d).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function outcomeChip(outcome: Experiment["outcome"]) {
  if (outcome === "success") return <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">✅ Success</span>;
  if (outcome === "partial")  return <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">⚠️ Partial</span>;
  if (outcome === "failed")   return <span className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-full px-2 py-0.5">❌ Failed</span>;
  return <span className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-full px-2 py-0.5">⏳ In progress</span>;
}

type NodeProps = {
  exp: Experiment;
  currentId: string;
  depth: number;
};

function TreeNode({ exp, currentId, depth }: NodeProps) {
  const author  = getProfile(exp.user_id);
  const forks   = getForks(exp.id);
  const isCurrent = exp.id === currentId;

  return (
    <div className={`${depth > 0 ? "ml-6 border-l-2 border-slate-200 pl-4" : ""}`}>
      <div className={`rounded-xl border p-3 mb-2 transition-all ${isCurrent ? "border-blue-300 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-xs font-mono text-slate-500 border border-slate-200 bg-white rounded px-1.5 py-0.5">{exp.protocol_version}</span>
              {outcomeChip(exp.outcome)}
              {isCurrent && <span className="text-xs font-bold text-blue-600 bg-blue-100 rounded-full px-2 py-0.5">← Current</span>}
              {depth === 0 && <span className="text-xs text-slate-400">Original</span>}
            </div>
            {isCurrent ? (
              <p className="text-sm font-semibold text-slate-900 truncate">{exp.title}</p>
            ) : (
              <Link href={`/experiments/${exp.id}`} className="text-sm font-medium text-slate-800 hover:text-blue-600 truncate block">
                {exp.title}
              </Link>
            )}
            <p className="text-xs text-slate-500 mt-0.5">
              {author?.full_name ?? "Unknown"}{author?.institution ? ` · ${author.institution}` : ""} · {timeAgo(exp.created_at)}
            </p>
          </div>
        </div>
      </div>
      {forks.map((fork) => (
        <TreeNode key={fork.id} exp={fork} currentId={currentId} depth={depth + 1} />
      ))}
    </div>
  );
}

type Props = { experiment: Experiment };

export default function VersionTree({ experiment }: Props) {
  // Walk up to find root
  let root = experiment;
  while (root.parent_id) {
    const parent = getExperiment(root.parent_id);
    if (!parent) break;
    root = parent;
  }

  const forks = getForks(root.id);
  if (forks.length === 0 && !experiment.parent_id) return null; // nothing to show for solitary experiments

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-6">
      <h2 className="font-semibold text-slate-900 mb-1 flex items-center gap-2">
        <span>🌿</span> Protocol Version Tree
        <span className="text-xs font-normal text-slate-400 ml-1">— GitHub-style lineage</span>
      </h2>
      <p className="text-xs text-slate-400 mb-4">Every fork maintains scientific provenance — methodology is never a black box.</p>
      <TreeNode exp={root} currentId={experiment.id} depth={0} />
    </div>
  );
}
