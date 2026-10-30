"use server";

import { requireUser } from "@/lib/session";
import { isRowId } from "@/lib/query";

const KINDS = ["post", "reply", "answer", "question", "message", "profile"] as const;
const REASONS = ["spam", "abuse", "misconduct", "personal-data", "other"] as const;

/**
 * Report something to the moderation team. Stored in `reports`
 * (supabase/10-journeys.sql), which members cannot read except their own
 * reports; the team reviews them with the service role. Reporting the same
 * thing twice is accepted quietly.
 */
export async function reportContent(kind: string, targetId: string, form: FormData): Promise<{ ok: true } | { error: string }> {
  const { supabase, user } = await requireUser();
  const reason = String(form.get("reason") ?? "");
  if (!(KINDS as readonly string[]).includes(kind) || !isRowId(targetId)) return { error: "That cannot be reported." };
  if (!(REASONS as readonly string[]).includes(reason)) return { error: "Choose a reason." };
  const { data: already } = await supabase.from("reports").select("id").eq("reporter_id", user.id).eq("target_kind", kind).eq("target_id", targetId).maybeSingle();
  if (!already) {
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id, target_kind: kind, target_id: targetId, reason,
      note: String(form.get("note") ?? "").trim().slice(0, 1000),
    });
    if (error) return { error: "The report could not be sent. Please try again or use the contact form." };
  }
  return { ok: true };
}
