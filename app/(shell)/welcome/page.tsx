import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinHouses } from "@/app/actions/rooms";
import { HOUSES, roomsInHouse } from "@/lib/taxonomy";
import { Page, Panel, btnPrimary, mono } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * First run: pick your houses.
 *
 * This is the whole of onboarding for the communication module, and it is one
 * screen on purpose. Picking a house joins the rooms inside it, so the feed
 * has something in it the moment you arrive — the alternative is an empty
 * page and a tag search, which is where new accounts go to die.
 */
export default async function Welcome({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { count } = await supabase
    .from("user_rooms").select("room_id", { count: "exact", head: true }).eq("user_id", user!.id);
  if ((count ?? 0) > 0) redirect("/home");

  return (
    <Page
      title="Pick your houses"
      lede="A house is a broad discipline. Choosing one joins you to the rooms inside it, and you can prune or add later. Most researchers pick two or three — the cross-disciplinary rooms are where the useful surprises are."
    >
      {error === "none" && (
        <p role="alert" style={{ maxWidth: 900, font: "400 13.5px/1.5 var(--sans)", margin: "0 0 12px", padding: "10px 12px", border: "1px solid var(--err)", color: "var(--err)", background: "var(--surface)" }}>
          Pick at least one house. Your feed is built from the rooms inside the houses you choose.
        </p>
      )}
      <form action={joinHouses} style={{ maxWidth: 900 }}>
        <div className="sc-pair" style={{ gap: 12 }}>
          {HOUSES.map((h) => {
            const rooms = roomsInHouse(h.id);
            return (
              <label key={h.id} style={{ display: "block", cursor: "pointer" }}>
                <Panel style={{ padding: 14, height: "100%" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <input type="checkbox" name="house" value={h.id} style={{ marginTop: 3 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ font: mono(13.5, 500) }}>{h.name}</div>
                      <div style={{ font: "400 13px/1.5 var(--sans)", color: "var(--mute)", marginTop: 4 }}>{h.blurb}</div>
                      <div style={{ font: mono(10.5), color: "var(--mute)", marginTop: 7 }}>
                        {rooms.length} rooms · {rooms.slice(0, 3).map((r) => "#" + r.id).join("  ")}
                      </div>
                    </div>
                  </div>
                </Panel>
              </label>
            );
          })}
        </div>
        <button type="submit" style={{ ...btnPrimary, marginTop: 14, height: 42 }}>
          Join these rooms →
        </button>
      </form>
    </Page>
  );
}
