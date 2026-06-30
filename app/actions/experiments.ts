"use server";

import { createAdminClient } from "@/lib/supabase/admin";

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

export async function saveExperimentToDb(data: SaveInput): Promise<DbExperiment> {
  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("experiments")
    .insert(data)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return row as DbExperiment;
}

export async function getAllExperimentsFromDb(): Promise<DbExperiment[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DbExperiment[];
}

export async function getExperimentFromDb(id: string): Promise<DbExperiment | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as DbExperiment;
}

export async function updateExperimentInDb(
  id: string,
  patch: Partial<SaveInput>
): Promise<DbExperiment | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("experiments")
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) return null;
  return data as DbExperiment;
}

export async function deleteExperimentFromDb(id: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("experiments").delete().eq("id", id);
  return !error;
}

export async function getMyExperimentsFromDb(userId: string): Promise<DbExperiment[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as DbExperiment[];
}
