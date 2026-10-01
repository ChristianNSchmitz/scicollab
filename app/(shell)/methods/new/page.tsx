import { createCard } from "@/app/actions/cards";
import { Page, Panel, PanelHead, field, fieldLabel, btnPrimary, mono } from "@/components/ui";

/** Method card editor — board C2 screen 10. The outcome is three states, and
 *  'fails under' is a first-class field rather than a note at the bottom. */
export default function NewMethod() {
  return (
    <Page title="Record a method" lede="Everything here is what a peer needs to reproduce the run, or to know not to try it.">
      <form action={createCard}>
        <div className="sc-two-col">
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Panel>
              <PanelHead>The method</PanelHead>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
                <div>
                  <label style={fieldLabel} htmlFor="title">Title — what a peer will search for</label>
                  <input id="title" name="title" required style={field} placeholder="Lipofection of HEK293T at low passage" />
                </div>
                <div>
                  <label style={fieldLabel} htmlFor="method">Method</label>
                  <textarea id="method" name="method" rows={4} style={field} placeholder="Lipofectamine 3000, 48 h expression, DMEM + 10% FBS…" />
                </div>
                <div className="sc-pair" style={{ gap: 12 }}>
                  <div>
                    <label style={fieldLabel} htmlFor="system">System — cell line, organism, model</label>
                    <input id="system" name="system" style={field} placeholder="HEK293T · p<12" />
                  </div>
                  <div>
                    <label style={fieldLabel} htmlFor="conditions">Conditions</label>
                    <input id="conditions" name="conditions" style={field} placeholder="37 °C · 5% CO₂ · 48 h" />
                  </div>
                </div>
                <div>
                  <label style={fieldLabel} htmlFor="tags">Tags — comma separated</label>
                  <input id="tags" name="tags" style={field} placeholder="transfection, HEK293T, lipofection" />
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHead>What happened</PanelHead>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 13 }}>
                <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
                  <legend style={{ ...fieldLabel, padding: 0 }}>Outcome</legend>
                  <div style={{ display: "flex", gap: 8 }}>
                    {[
                      ["success", "Success", "worked as expected"],
                      ["partial", "Partial", "some useful data"],
                      ["negative", "Negative result", "recorded so nobody repeats it"],
                    ].map(([v, label, hint]) => (
                      <label key={v} style={{ flex: 1, border: "1px solid var(--rule)", padding: "10px 11px", cursor: "pointer", background: "var(--bg)" }}>
                        <input type="radio" name="outcome" value={v} style={{ marginRight: 7 }} />
                        <span style={{ font: mono(12, 500) }}>{label}</span>
                        <span style={{ display: "block", font: "400 11px/1.4 var(--sans)", color: "var(--mute)", marginTop: 4 }}>{hint}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label style={fieldLabel} htmlFor="outcome_detail">Result</label>
                  <textarea id="outcome_detail" name="outcome_detail" rows={3} style={field} placeholder="38% ± 6 — below target across three biological replicates." />
                </div>
                <div>
                  <label style={fieldLabel} htmlFor="fails_under">Fails under — the part nobody else writes down</label>
                  <textarea id="fails_under" name="fails_under" rows={3} style={field} placeholder="Passage above 18, or serum-free medium at transfection. Both tried, both below 5%." />
                </div>
              </div>
            </Panel>
          </div>

          <aside style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Panel>
              <PanelHead>Visibility</PanelHead>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 9 }}>
                {[
                  ["private", "Private", "only you — the default"],
                  ["lab", "Lab", "your workspace"],
                  ["public", "Public", "anyone on SciCollab"],
                ].map(([v, label, hint], i) => (
                  <label key={v} style={{ border: "1px solid var(--rule)", padding: "9px 10px", cursor: "pointer" }}>
                    <input type="radio" name="visibility" value={v} defaultChecked={i === 0} style={{ marginRight: 7 }} />
                    <span style={{ font: mono(12, 500) }}>{label}</span>
                    <span style={{ display: "block", font: "400 11px/1.4 var(--sans)", color: "var(--mute)", marginTop: 3 }}>{hint}</span>
                  </label>
                ))}
                <p style={{ font: "400 11px/1.55 var(--sans)", color: "var(--mute)", margin: "2px 0 0" }}>
                  You can raise visibility later. Public plus a DOI is designed as irreversible — that decision is still open on board K5.
                </p>
              </div>
            </Panel>
            <button type="submit" style={{ ...btnPrimary, height: 42, justifyContent: "center" }}>Record method</button>
          </aside>
        </div>
      </form>
    </Page>
  );
}
