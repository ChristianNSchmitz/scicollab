"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient, DEMO_COOKIE } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isConfigured } from "@/lib/mode";
import { isSeededAccount, forget } from "@/lib/demo/store";

/**
 * Deleting an account (GDPR art. 17). Every table that belongs to a person
 * references auth.users with on delete cascade, so removing the auth user
 * removes their profile, cards, questions, answers, posts, messages,
 * projects they own and synced publications in one step. Uploaded pictures
 * live in storage, outside the database, and are removed first.
 */
export async function deleteAccount(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (String(form.get("confirm") ?? "").trim().toUpperCase() !== "DELETE") redirect("/settings?error=confirm#account");

  if (!isConfigured()) {
    // Seeded accounts have to stay for everyone else using the demo.
    if (isSeededAccount(user.id)) redirect("/settings?error=demo#account");
    forget(user.id);
    (await cookies()).delete(DEMO_COOKIE);
    redirect("/?deleted=1");
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) redirect("/settings?error=nokey#account");
  const admin = createAdminClient();
  const { data: files } = await admin.storage.from("avatars").list(user.id);
  if (files?.length) await admin.storage.from("avatars").remove(files.map((f) => `${user.id}/${f.name}`));
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) redirect("/settings?error=delete#account");
  await supabase.auth.signOut();
  redirect("/?deleted=1");
}
