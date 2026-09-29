import Link from "next/link";
import Screen from "@/components/Screen";
import { mono } from "@/components/ui";

/**
 * A destination that exists as a design board but is not wired to data yet.
 *
 * It mounts the real artboard rather than a placeholder, and says plainly
 * which board it came from and what is missing — so the gap is visible
 * instead of being mistaken for a working feature.
 */
export default function Designed({
  screen, board, title, missing,
}: { screen: string; board: string; title: string; missing: string }) {
  return (
    <div style={{ padding: "16px 16px 64px" }}>
      <div
        style={{
          maxWidth: 1440, margin: "0 auto 14px", display: "flex", gap: 12,
          alignItems: "baseline", flexWrap: "wrap", padding: "11px 14px",
          border: "1px solid var(--flag)", background: "var(--surface)",
        }}
      >
        <span style={{ font: mono(10, 700), letterSpacing: ".1em", color: "#8A6A00" }}>DESIGNED · NOT WIRED</span>
        <span style={{ font: mono(12, 500) }}>{title}</span>
        <span style={{ font: "400 12px/1.5 var(--sans)", color: "var(--mute)", flex: 1, minWidth: 260 }}>
          {missing}
        </span>
        <span style={{ font: mono(10.5), color: "var(--mute)" }}>board {board}</span>
        <Link href="/home" style={{ font: mono(11, 500), color: "var(--link)" }}>← Home</Link>
      </div>
      <div style={{ maxWidth: 1440, margin: "0 auto", overflowX: "auto" }}>
        <Screen id={screen} />
      </div>
    </div>
  );
}
