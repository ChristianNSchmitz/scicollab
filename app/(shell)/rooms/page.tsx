import { createClient } from "@/lib/supabase/server";
import { joinRoom, leaveRoom } from "@/app/actions/rooms";
import { HOUSES, ROOMS, roomsInHouse, housesOfRoom, isShared } from "@/lib/taxonomy";
import { Page, Panel, PanelHead, Tag, btn, mono } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * Room directory, grouped by house.
 *
 * A room appears under every house it belongs to, and says so — that
 * repetition is the point. It is how someone in zoology discovers that the
 * western blot room is the same one the neuroscientists are already in.
 */
export default async function Rooms() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: mine } = await supabase
    .from("user_rooms").select("room_id").eq("user_id", user!.id);
  const joined = new Set((mine ?? []).map((r: { room_id: string }) => r.room_id));

  return (
    <Page
      title="Rooms"
      lede={`A house is a discipline; a room is a technique or a shared problem. Rooms are not owned by one house — ${ROOMS.filter((r) => isShared(r.id)).length} of ${ROOMS.length} sit in more than one, because the same method fails the same way in different fields.`}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        {HOUSES.map((house) => {
          const rooms = roomsInHouse(house.id);
          return (
            <Panel key={house.id}>
              <PanelHead>
                {house.name} · {rooms.length} rooms
              </PanelHead>
              <div style={{ padding: "10px 14px", font: "400 12px/1.5 var(--sans)", color: "var(--mute)", borderBottom: "1px solid var(--rule)" }}>
                {house.blurb}
              </div>
              {rooms.map((room) => {
                const inIt = joined.has(room.id);
                const elsewhere = housesOfRoom(room.id).filter((h) => h.id !== house.id);
                return (
                  <div key={room.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ font: mono(13.5, 500) }}>#{room.id}</div>
                      <div style={{ font: "400 12px/1.55 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{room.blurb}</div>
                      {elsewhere.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
                          <span style={{ font: mono(9.5, 700), letterSpacing: ".09em", color: "var(--signal)" }}>ALSO IN</span>
                          {elsewhere.map((h) => <Tag key={h.id}>{h.name}</Tag>)}
                        </div>
                      )}
                    </div>
                    <form action={inIt ? leaveRoom.bind(null, room.id) : joinRoom.bind(null, room.id)}>
                      <button
                        type="submit"
                        style={{
                          ...btn, height: 30,
                          background: inIt ? "var(--ink)" : "transparent",
                          color: inIt ? "var(--bg)" : "var(--ink)",
                        }}
                      >
                        {inIt ? "Joined" : "Join"}
                      </button>
                    </form>
                  </div>
                );
              })}
            </Panel>
          );
        })}
      </div>
    </Page>
  );
}
