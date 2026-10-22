"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { roomsInHouse, roomById } from "@/lib/taxonomy";


export async function joinRoom(roomId: string) {
  const { supabase, user } = await requireUser();
  if (!roomById(roomId)) return;   // only rooms that exist in the taxonomy
  await supabase.from("user_rooms").insert({ user_id: user.id, room_id: roomId });
  revalidatePath("/rooms");
  revalidatePath("/home");
}

export async function leaveRoom(roomId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("user_rooms").delete().eq("user_id", user.id).eq("room_id", roomId);
  revalidatePath("/rooms");
  revalidatePath("/home");
}

/** Onboarding: picking houses joins the rooms they contain, so a new
 *  account never lands on an empty feed. Rooms can be pruned afterwards. */
export async function joinHouses(form: FormData) {
  const { supabase, user } = await requireUser();
  const houses = form.getAll("house").map(String);
  // With nothing picked, Home would send the researcher straight back here
  // with no explanation; say so instead.
  if (houses.length === 0) redirect("/welcome?error=none");

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
