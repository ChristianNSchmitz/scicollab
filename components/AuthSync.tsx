"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { setCurrentUserId, saveMockProfile, getCurrentUserId } from "@/lib/mock-db";

/**
 * Bridges the Supabase session into the localStorage layer.
 *
 * Half the app (feed, messages, projects, …) still runs on mock-db, which
 * keys everything off scicollab_session. Without this sync a Supabase user
 * would see data belonging to the old "mock-user" identity — including
 * someone else's seeded notifications.
 */
export default function AuthSync() {
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return;

      const alreadySynced = getCurrentUserId() === user.id;
      setCurrentUserId(user.id);

      // Cache the Supabase profile locally so synchronous mock-db consumers
      // (NavBar avatar, comment authors, …) resolve the real name.
      const { data: prof } = await supabase
        .from("profiles").select("*").eq("id", user.id).single();

      if (prof && !alreadySynced) {
        saveMockProfile({
          full_name:       prof.full_name || user.email || "Researcher",
          institution:     prof.institution || "",
          orcid_id:        prof.orcid_id ?? null,
          role:            prof.role || "",
          research_domain: prof.research_domain || "",
          techniques:      prof.techniques ?? [],
        });
      }
    });
  }, []);

  return null;
}
