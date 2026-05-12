"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Experiment = {
  id: string;
  title: string;
  protocol_version: string;
  hypothesis: string | null;
  methods: string | null;
  conditions: string | null;
  reagents: unknown[];
  technique_tags: string[];
  organism_tags: string[];
  outcome: string | null;
  outcome_summary: string | null;
  failure_context: string | null;
  root_cause: string | null;
  attached_files: unknown[];
  code_notebook_url: string | null;
  visibility: string;
  co_authors: string[];
};

type Props = {
  experiment: Experiment;
  currentUserId: string | null;
};

export default function ForkButton({ experiment, currentUserId }: Props) {
  const router = useRouter();
  const [forking, setForking] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");

  async function handleFork() {
    if (!currentUserId) {
      router.push("/login");
      return;
    }
    setForking(true);
    setError("");

    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", currentUserId)
      .single();

    if (!profile) {
      setError("Profile not found. Complete onboarding first.");
      setForking(false);
      return;
    }

    const { data: fork, error: forkError } = await supabase
      .from("experiments")
      .insert({
        user_id: currentUserId,
        parent_id: experiment.id,
        title: `${experiment.title} (fork)`,
        protocol_version: experiment.protocol_version,
        hypothesis: experiment.hypothesis,
        methods: experiment.methods,
        conditions: experiment.conditions,
        reagents: experiment.reagents,
        technique_tags: experiment.technique_tags,
        organism_tags: experiment.organism_tags,
        outcome: null,
        outcome_summary: null,
        failure_context: null,
        root_cause: null,
        attached_files: [],
        code_notebook_url: null,
        visibility: "lab",
        co_authors: [],
      })
      .select("id")
      .single();

    if (forkError) {
      setError(forkError.message);
      setForking(false);
      return;
    }

    router.push(`/experiments/${fork.id}?forked=true`);
  }

  if (!showConfirm) {
    return (
      <button
        onClick={() => currentUserId ? setShowConfirm(true) : router.push("/login")}
        className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-600 hover:bg-slate-50 transition-colors font-medium"
      >
        🔁 Fork Protocol
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600">Fork this protocol?</span>
      <button
        onClick={handleFork}
        disabled={forking}
        className="text-xs bg-blue-600 text-white rounded-lg px-3 py-1.5 hover:bg-blue-700 transition-colors font-medium disabled:opacity-60 flex items-center gap-1"
      >
        {forking ? (
          <>
            <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Forking…
          </>
        ) : "Yes, fork"}
      </button>
      <button
        onClick={() => setShowConfirm(false)}
        disabled={forking}
        className="text-xs text-slate-400 hover:text-slate-600"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}
