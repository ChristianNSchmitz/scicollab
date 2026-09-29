import Link from "next/link";
import manifest from "@/design/screens/manifest.json";
import { mono } from "@/components/ui";

export const metadata = { title: "Screens · SciCollab" };

type Entry = { id: string; num: string; name: string; dim: string; width: number; board: string; code: string };

/** Every artboard lifted from the September boards, mounted individually.
 *  A build aid: it makes the extraction checkable screen by screen. */
export default function Boards() {
  const screens = manifest as Entry[];
  const byBoard = new Map<string, Entry[]>();
  for (const s of screens) {
    if (!byBoard.has(s.board)) byBoard.set(s.board, []);
    byBoard.get(s.board)!.push(s);
  }

  return (
    <div style={{ background: "var(--bg)", minHeight: "100vh", padding: "32px 24px 72px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ font: mono(10.5, 700), letterSpacing: ".14em", color: "var(--signal)", marginBottom: 10 }}>
          EXTRACTED FROM THE SEPTEMBER BOARDS
        </div>
        <h1 style={{ font: mono(30, 700, 1.1), margin: "0 0 8px", letterSpacing: "-.02em" }}>Screens</h1>
        <p style={{ font: "400 13px/1.7 var(--sans)", color: "var(--mute)", margin: "0 0 28px", maxWidth: "70ch" }}>
          {screens.length} artboards, mounted exactly as designed. The ones the platform actually uses are wired into
          routes; the rest are here so the extraction can be checked. <Link href="/" style={{ color: "var(--link)" }}>Back to the site</Link>.
        </p>

        {[...byBoard.entries()].map(([board, list]) => (
          <section key={board} style={{ marginBottom: 26 }}>
            <h2 style={{ font: mono(12, 700), letterSpacing: ".08em", textTransform: "uppercase", color: "var(--ink)", borderBottom: "1px solid var(--ink)", paddingBottom: 7, marginBottom: 0 }}>
              {board} <span style={{ color: "var(--mute)", fontWeight: 400 }}>· {list.length}</span>
            </h2>
            <div style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderTop: 0 }}>
              {list.map((s) => (
                <Link key={s.id} href={`/boards/${s.id}`} style={{ display: "flex", gap: 12, alignItems: "baseline", padding: "9px 12px", borderBottom: "1px solid var(--rule)", color: "var(--ink)", textDecoration: "none" }}>
                  <span style={{ font: mono(10.5, 700), color: "var(--signal)", width: 26, flex: "none" }}>{s.num}</span>
                  <span style={{ font: mono(12.5, 500), flex: 1, minWidth: 0 }}>{s.name}</span>
                  <span style={{ font: mono(10.5), color: "var(--mute)" }}>{s.width}px</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
