/**
 * Says plainly that the content is fabricated.
 *
 * The seeded researchers and their results are invented. On a laptop that is
 * obvious from context; on a public domain it is not, and a visitor would
 * reasonably read them as real people and real findings. This is the cheapest
 * honest fix — it sits above everything and does not depend on anyone
 * noticing a marker on an individual record.
 */
export default function DemoNotice() {
  if (process.env.SCICOLLAB_HIDE_DEMO_NOTICE === "1") return null;
  return (
    <div
      role="note"
      style={{
        background: "var(--flag)", color: "#0D0D0D",
        borderBottom: "1px solid var(--ink)",
        padding: "7px 16px", display: "flex", gap: 10,
        alignItems: "baseline", flexWrap: "wrap",
        font: "500 11.5px/1.5 var(--mono)",
      }}
    >
      <span style={{ fontWeight: 700, letterSpacing: ".08em" }}>PREVIEW BUILD</span>
      <span style={{ fontWeight: 400 }}>
        Everything here is example data. The researchers, results and institutions are invented —
        nothing on this site is a real finding.
      </span>
    </div>
  );
}
