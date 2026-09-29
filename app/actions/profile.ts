"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function saveProfile(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: String(form.get("display_name") ?? "").trim(),
      institution:  String(form.get("institution") ?? "").trim(),
      role_title:   String(form.get("role_title") ?? "").trim(),
      field:        String(form.get("field") ?? "").trim(),
      orcid:        String(form.get("orcid") ?? "").trim() || null,
      techniques:   String(form.get("techniques") ?? "").split(",").map(t => t.trim()).filter(Boolean),
    })
    .eq("id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath("/you");
  revalidatePath("/settings");
}
