import { createClient } from "@/lib/supabase/server";
import { askQuestion } from "@/app/actions/qa";
import { Page, Panel, PanelHead, field, fieldLabel, btnPrimary, mono } from "@/components/ui";

export const dynamic = "force-dynamic";

/** Ask — board C1 screen 1. A question is a structured instrument, not a text
 *  box: it can carry the artifact that produced it. */
export default async function Ask({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const { card } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: cards } = await supabase
    .from("method_cards")
    .select("id, code, title")
    .eq("author_id", user!.id)
    .order("created_at", { ascending: false });

  return (
    <Page title="Ask a question" lede="Attach the run it came from. Peers answer conditions, not paraphrases.">
      <form action={askQuestion}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
          <Panel>
            <PanelHead>The question</PanelHead>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
              <div>
                <label style={fieldLabel} htmlFor="title">Title</label>
                <input id="title" name="title" required style={field} placeholder="Transfection efficiency collapses above passage 18 — what am I missing?" />
              </div>
              <div>
                <label style={fieldLabel} htmlFor="body">What you have tried</label>
                <textarea id="body" name="body" rows={8} style={field} placeholder="Three biological replicates, two reagent lots, fresh medium each time…" />
              </div>
              <div>
                <label style={fieldLabel} htmlFor="tags">Tags — comma separated</label>
                <input id="tags" name="tags" style={field} placeholder="transfection, HEK293T, passage number" />
              </div>
            </div>
          </Panel>

          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Panel>
              <PanelHead>Attach a method card</PanelHead>
              <div style={{ padding: 14 }}>
                {cards && cards.length > 0 ? (
                  <select name="method_card_id" defaultValue={card ?? ""} style={{ ...field, height: 38 }}>
                    <option value="">No card attached</option>
                    {cards.map((c: { id: string; code: string; title: string }) => (
                      <option key={c.id} value={c.id}>{c.code} — {c.title}</option>
                    ))}
                  </select>
                ) : (
                  <p style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>
                    You have no method cards yet. A question without one still works, it just makes peers guess.
                  </p>
                )}
              </div>
            </Panel>
            <button type="submit" style={{ ...btnPrimary, height: 42, justifyContent: "center" }}>Post question</button>
          </aside>
        </div>
      </form>
    </Page>
  );
}
