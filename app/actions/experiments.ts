"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type DbExperiment = {
  id: string;
  user_id: string;
  parent_id: string | null;
  title: string;
  protocol_version: string;
  hypothesis: string | null;
  methods: string | null;
  conditions: string | null;
  reagents: { name: string; concentration: string; supplier: string }[];
  technique_tags: string[];
  organism_tags: string[];
  outcome: "success" | "partial" | "failed" | null;
  outcome_summary: string | null;
  failure_context: string | null;
  root_cause: string | null;
  attached_files: { name: string; type: string; size: string }[];
  code_notebook_url: string | null;
  visibility: "lab" | "network" | "public";
  embargo_until: string | null;
  co_authors: string[];
  created_at: string;
  updated_at: string;
};

type SaveInput = Omit<DbExperiment, "id" | "created_at" | "updated_at">;

/** Returns the authenticated Supabase user id, or null. */
async function authedUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function saveExperimentToDb(data: SaveInput): Promise<DbExperiment> {
  const userId = await authedUserId();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("experiments")
    .insert({ ...data, user_id: userId }) // never trust client-provided user_id
    .select()
    .single();

  if (error) throw new Error(error.message);
  return row as DbExperiment;
}

/**
 * All experiments the current user is allowed to see:
 * public + network experiments, plus their own (any visibility).
 */
export async function getAllExperimentsFromDb(): Promise<DbExperiment[]> {
  const userId = await authedUserId();
  if (!userId) return [];

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .or(`visibility.in.(public,network),user_id.eq.${userId}`)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DbExperiment[];
}

export async function getExperimentFromDb(id: string): Promise<DbExperiment | null> {
  const userId = await authedUserId();
  if (!userId) return null;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  const exp = data as DbExperiment;
  // lab-visibility experiments are only visible to their owner
  if (exp.visibility === "lab" && exp.user_id !== userId) return null;
  return exp;
}

export async function updateExperimentInDb(
  id: string,
  patch: Partial<SaveInput>
): Promise<DbExperiment | null> {
  const userId = await authedUserId();
  if (!userId) return null;

  const supabase = createAdminClient();
  // Ownership check: only the owner may update
  const { data, error } = await supabase
    .from("experiments")
    .update(patch)
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return null;
  return data as DbExperiment;
}

export async function deleteExperimentFromDb(id: string): Promise<boolean> {
  const userId = await authedUserId();
  if (!userId) return false;

  const supabase = createAdminClient();
  // Ownership check: only the owner may delete
  const { error, count } = await supabase
    .from("experiments")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", userId);

  return !error && (count ?? 0) > 0;
}

export async function getMyExperimentsFromDb(userId: string): Promise<DbExperiment[]> {
  const authed = await authedUserId();
  if (!authed) return [];
  // Ignore the passed id if it isn't the caller — you can only list your own
  const targetId = userId === authed ? userId : authed;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("user_id", targetId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DbExperiment[];
}
