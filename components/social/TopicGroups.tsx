import { joinRoom, leaveRoom } from "@/app/actions/rooms";
import { HOUSES, ROOMS } from "@/lib/taxonomy";
import { btn, mono } from "@/components/ui";
import Link from "next/link";

/**
 * Topic groups (called rooms in the code and the database): one per
 * technique or shared problem. Each is listed once, yours first, with the
 * fields it belongs to; a field filter narrows the list.
 */
export default function TopicGroups({ joined, field }: { joined: Set<string>; field?: string }) {
  const houseName = (id: string) => HOUSES.find((h) => h.id === id)?.name ?? id;
  const rooms = ROOMS.filter((r) => !field || r.houses.includes(field))
    .sort((a, b) => Number(joined.has(b.id)) - Number(joined.has(a.id)) || a.id.localeCompare(b.id));
  const chip = (on: boolean) => ({ padding: "6px 12px", borderRadius: 999, font: "500 12.5px/1 var(--sans)", textDecoration: "none", whiteSpace: "nowrap" as const,
    border: `1px solid ${on ? "var(--ink)" : "var(--rule)"}`, background: on ? "var(--ink)" : "transparent", color: on ? "var(--bg)" : "var(--ink)" });
  return (
    <>
      <nav aria-label="Fields" className="sc-filter" style={{ marginBottom: 12 }}>
        <Link href="/groups#topics" style={chip(!field)}>All fields</Link>
        {HOUSES.map((h) => <Link key={h.id} href={`/groups?field=${h.id}#topics`} style={chip(field === h.id)}>{h.name}</Link>)}
      </nav>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
        {rooms.map((room) => {
          const inIt = joined.has(room.id);
          return (
            <div key={room.id} className="sc-soft" style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "12px 14px", border: "1px solid var(--rule)", borderRadius: 16, background: "var(--surface)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <Link href={`/home?room=${room.id}`} style={{ font: mono(13.5, 600), color: "var(--ink)" }}>#{room.id}</Link>
                <div style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{room.blurb}</div>
                <div style={{ font: "400 11.5px/1.5 var(--sans)", color: "var(--mute)", marginTop: 5 }} title={room.houses.map(houseName).join(", ")}>
                  {room.houses.length > 2 ? `Shared across ${room.houses.length} fields` : room.houses.map(houseName).join(" · ")}
                </div>
              </div>
              <form action={inIt ? leaveRoom.bind(null, room.id) : joinRoom.bind(null, room.id)}>
                <button type="submit" style={{ ...btn, height: 30, borderRadius: 999, background: inIt ? "var(--ink)" : "transparent", color: inIt ? "var(--bg)" : "var(--ink)" }}>
                  {inIt ? "Joined" : "Join"}
                </button>
              </form>
            </div>
          );
        })}
      </div>
    </>
  );
}
