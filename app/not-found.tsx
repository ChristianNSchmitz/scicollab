import Link from "next/link";
import { btn, btnPrimary, mono } from "@/components/ui";

/** Shown for any unknown route, and for a card, project or question that does
 *  not exist or that you cannot see. Always offers a way back in. */
export default function NotFound() {
  return (
    <div style={{ minHeight: "70vh", background: "var(--canvas)", display: "grid", placeItems: "center", padding: 16 }}>
      <div className="sc-soft" style={{ maxWidth: 520, width: "100%", background: "var(--surface)", border: "1px solid var(--rule)", padding: 24 }}>
        <div style={{ font: mono(10, 700), letterSpacing: ".1em", color: "var(--mute)", marginBottom: 10 }}>404 · NOT FOUND</div>
        <h1 className="sc-title" style={{ font: mono(19, 700, 1.25), margin: "0 0 8px" }}>Nothing here.</h1>
        <p style={{ font: "400 14px/1.6 var(--sans)", color: "var(--mute)", margin: "0 0 18px" }}>
          The page may have moved, or it belongs to something that is private or was deleted.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/home" className="sc-pill" style={btnPrimary}>Go to Home</Link>
          <Link href="/search" className="sc-pill" style={btn}>Search</Link>
          <Link href="/methods" className="sc-pill" style={btn}>Methods</Link>
        </div>
      </div>
    </div>
  );
}
