/**
 * Shown the moment a link inside the app is clicked, while the next page
 * renders. Without it a click gave no sign of life until the whole page had
 * arrived. Shaped like a page header and two panels so the swap is calm.
 */
export default function Loading() {
  const bar = (w: string, h = 12): React.CSSProperties => ({
    width: w, height: h, background: "var(--rule)", opacity: 0.55,
    animation: "scpulse 1.6s ease-in-out infinite",
  });
  return (
    <div role="status" aria-live="polite" style={{ padding: "24px 16px 64px" }}>
      <span style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" }}>Loading…</span>
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
        <div style={{ paddingBottom: 14, marginBottom: 20, borderBottom: "1px solid var(--ink)", display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={bar("38%", 20)} />
          <div style={bar("62%")} />
        </div>
        {[0, 1].map((i) => (
          <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--rule)", marginBottom: 12 }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--rule)" }}><div style={bar("22%", 10)} /></div>
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={bar("90%")} /><div style={bar("76%")} /><div style={bar("54%")} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
