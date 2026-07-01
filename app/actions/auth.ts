"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function saveProfileToDb(profile: {
  id: string;
  full_name: string;
  institution: string;
  orcid_id: string | null;
  role: string;
  research_domain: string;
  techniques: string[];
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").upsert(profile);
  if (error) throw new Error(error.message);
}
