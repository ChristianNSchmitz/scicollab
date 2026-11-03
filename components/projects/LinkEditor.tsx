import { btn, btnPrimary, mono } from "@/components/ui";

type Choice = { id: string; text: string };

/**
 * Where a dataset's owner ties it to the code that produced it and the
 * notebook entries that discuss its results. Entirely optional, and closed
 * until asked for. What is ticked is linked; saving replaces the set.
 */
export default function LinkEditor({ action, code, entries, linkedCode, linkedEntries }: {
  action: (form: FormData) => void | Promise<void>;
  code: Choice[]; entries: Choice[]; linkedCode: string[]; linkedEntries: string[];
}) {
  const count = linkedCode.length + linkedEntries.length;
  const group = (legend: string, name: string, items: Choice[], on: string[], empty: string) => (
    <fieldset style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <legend style={{ font: mono(10, 700), letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mute)", marginBottom: 6, padding: 0 }}>{legend}</legend>
      {items.length === 0 ? (
        <p style={{ font: "400 12.5px/1.6 var(--sans)", color: "var(--mute)", margin: 0 }}>{empty}</p>
      ) : (
        <div style={{ maxHeight: 190, overflowY: "auto", display: "flex", flexDirection: "column", gap: 2, padding: "2px 0" }}>
          {items.map((i) => (
            <label key={i.id} style={{ display: "flex", gap: 8, alignItems: "baseline", font: "400 13px/1.5 var(--sans)", cursor: "pointer", padding: "2px 0" }}>
              <input type="checkbox" name={name} value={i.id} defaultChecked={on.includes(i.id)} style={{ flex: "none" }} />
              <span style={{ overflowWrap: "anywhere" }}>{i.text}</span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
  return (
    <details style={{ marginTop: 10 }}>
      <summary style={{ ...btn, height: 28, padding: "0 12px", borderRadius: 999, cursor: "pointer", listStyle: "none", display: "inline-flex" }}>
        {count ? `Edit links · ${count}` : "Link code & notebook"}
      </summary>
      <form action={action} style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 10, padding: 12, border: "1px solid var(--rule)", borderRadius: 14, background: "var(--bg)" }}>
        <p style={{ font: "400 12.5px/1.65 var(--sans)", color: "var(--mute)", margin: 0 }}>
          Optional. Tick the code that produced this data and the notebook entries that discuss its results. Only the people on
          this project see these links. To let someone follow them, add that person under People.
        </p>
        {group("Code that produced it", "code", code, linkedCode, "No code files in this project yet. They appear here once added.")}
        {group("Notebook entries about it", "entry", entries, linkedEntries, "No notebook entries in this project yet.")}
        <div><button type="submit" style={btnPrimary}>Save links</button></div>
      </form>
    </details>
  );
}
