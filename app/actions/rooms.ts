"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { roomsInHouse } from "@/lib/taxonomy";

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export async function joinRoom(roomId: string) {
  const { supabase, user } = await me();
  await supabase.from("user_rooms").insert({ user_id: user.id, room_id: roomId });
  revalidatePath("/rooms");
  revalidatePath("/home");
}

export async function leaveRoom(roomId: string) {
  const { supabase, user } = await me();
  await supabase.from("user_rooms").delete().eq("user_id", user.id).eq("room_id", roomId);
  revalidatePath("/rooms");
  revalidatePath("/home");
}

/** Onboarding: picking houses joins the rooms they contain, so a new
 *  account never lands on an empty feed. Rooms can be pruned afterwards. */
export async function joinHouses(form: FormData) {
  const { supabase, user } = await me();
  const houses = form.getAll("house").map(String);

  const roomIds = [...new Set(houses.flatMap((h) => roomsInHouse(h).map((r) => r.id)))];
  const { data: existing } = await supabase
    .from("user_rooms").select("room_id").eq("user_id", user.id);
  const already = new Set((existing ?? []).map((r: { room_id: string }) => r.room_id));

  const rows = roomIds.filter((id) => !already.has(id))
    .map((room_id) => ({ user_id: user.id, room_id }));
  if (rows.length) await supabase.from("user_rooms").insert(rows);

  revalidatePath("/home");
  redirect("/home");
}
