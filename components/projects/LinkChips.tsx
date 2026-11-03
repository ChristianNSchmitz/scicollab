import Link from "next/link";
import { mono } from "@/components/ui";

export type Chip = { href: string; text: string };

/**
 * A row of links to the things a data set, code file or notebook entry is
 * connected to inside its project (lib/data-links.ts). Each one jumps to that
 * item on its own tab. Renders nothing when there are none, so an unlinked item
 * looks exactly as it did before.
 */
export default function LinkChips({ label, chips }: { label: string; chips: Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginTop: 9 }}>
      <span style={{ font: mono(9.5, 700), letterSpacing: ".08em", color: "var(--mute)" }}>{label}</span>
      {chips.map((c) => (
        <Link key={c.href} href={c.href}
          style={{ font: mono(11.5, 500, 1.4), color: "var(--ink)", border: "1px solid var(--rule)", borderRadius: 999, padding: "3px 10px", textDecoration: "none", overflowWrap: "anywhere" }}>
          {c.text}
        </Link>
      ))}
    </div>
  );
}
