import { createClient } from "@/lib/supabase/server";
import { roomById } from "@/lib/taxonomy";
import PostComposer from "@/components/PostComposer";
import { Page } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Compose({
  searchParams,
}: { searchParams: Promise<{ room?: string; intent?: string; card?: string }> }) {
  const { room, intent, card } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: mine }, { data: cards }] = await Promise.all([
    supabase.from("user_rooms").select("room_id").eq("user_id", user!.id),
    supabase.from("method_cards").select("id, code, title").eq("author_id", user!.id).order("created_at", { ascending: false }),
  ]);

  const rooms = (mine ?? [])
    .map((r: { room_id: string }) => roomById(r.room_id))
    .filter(Boolean)
    .map((r) => ({ id: r!.id, name: r!.name }));

  return (
    <Page title="New post" lede="Pick what kind of post this is. It decides how the room can filter it, and whether it has to carry evidence.">
      <PostComposer
        rooms={rooms}
        cards={(cards ?? []) as { id: string; code: string; title: string }[]}
        defaultRoom={room}
        defaultIntent={intent}
        defaultCard={card}
      />
    </Page>
  );
}
