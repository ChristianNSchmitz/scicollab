"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { forkExperiment, type Experiment } from "@/lib/mock-db";

type Props = { experiment: Experiment; onForked?: () => void };

export default function ForkButton({ experiment }: Props) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [forking, setForking] = useState(false);

  function handleFork() {
    setForking(true);
    const fork = forkExperiment(experiment);
    router.push(`/experiments/${fork.id}?forked=true`);
  }

  if (!confirm) {
    return (
      <button onClick={() => setConfirm(true)}
        className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors font-medium">
        🔁 Fork Protocol
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600">Fork this protocol?</span>
      <button onClick={handleFork} disabled={forking}
        className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 flex items-center gap-1">
        {forking ? (
          <><svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Forking…</>
        ) : "Yes, fork"}
      </button>
      <button onClick={() => setConfirm(false)} disabled={forking} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
    </div>
  );
}
