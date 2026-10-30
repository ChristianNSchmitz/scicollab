import { joinRoom, leaveRoom } from "@/app/actions/rooms";
import { HOUSES, roomsInHouse, housesOfRoom } from "@/lib/taxonomy";
import { Panel, PanelHead, Tag, btn, mono } from "@/components/ui";
import Link from "next/link";

/**
 * Topic groups (called rooms in the code and the database): one per
 * technique or shared problem, listed under every field they belong to. That
 * repetition is the point: it is how someone in zoology finds that the
 * western blot group is the one the neuroscientists are already in.
 */
export default function TopicGroups({ joined }: { joined: Set<string> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {HOUSES.map((house) => {
        const rooms = roomsInHouse(house.id);
        return (
          <Panel key={house.id}>
            <PanelHead>{house.name} · {rooms.length} topic groups</PanelHead>
            <div style={{ padding: "10px 14px", font: "400 13px/1.5 var(--sans)", color: "var(--mute)", borderBottom: "1px solid var(--rule)" }}>
              {house.blurb}
            </div>
            {rooms.map((room) => {
              const inIt = joined.has(room.id);
              const elsewhere = housesOfRoom(room.id).filter((h) => h.id !== house.id);
              return (
                <div key={room.id} style={{ display: "flex", gap: 14, alignItems: "flex-start", padding: "12px 14px", borderBottom: "1px solid var(--rule)" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Link href={`/home?room=${room.id}`} style={{ font: mono(13.5, 500), color: "var(--ink)" }}>#{room.id}</Link>
                    <div style={{ font: "400 13px/1.55 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{room.blurb}</div>
                    {elsewhere.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 7, alignItems: "center" }}>
                        <span style={{ font: mono(9.5, 700), letterSpacing: ".09em", color: "var(--signal-ink)" }}>ALSO IN</span>
                        {elsewhere.map((h) => <Tag key={h.id}>{h.name}</Tag>)}
                      </div>
                    )}
                  </div>
                  <form action={inIt ? leaveRoom.bind(null, room.id) : joinRoom.bind(null, room.id)}>
                    <button type="submit" style={{ ...btn, height: 30, background: inIt ? "var(--ink)" : "transparent", color: inIt ? "var(--bg)" : "var(--ink)" }}>
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
  );
}
