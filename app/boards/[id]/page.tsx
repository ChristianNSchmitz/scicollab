import Link from "next/link";
import { notFound } from "next/navigation";
import Screen from "@/components/Screen";
import manifest from "@/design/screens/manifest.json";
import { mono } from "@/components/ui";

type Entry = { id: string; num: string; name: string; dim: string; width: number; board: string; code: string };

export async function generateStaticParams() {
  return (manifest as Entry[]).map((s) => ({ id: s.id }));
}

export default async function BoardScreen({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = (manifest as Entry[]).find((s) => s.id === id);
  if (!entry) notFound();

  return (
    <div style={{ background: "var(--canvas)", minHeight: "100vh", padding: 24 }}>
      <div style={{ maxWidth: 1440, margin: "0 auto 14px", display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
        <Link href="/boards" style={{ font: mono(11, 500), border: "1px solid var(--ink)", padding: "7px 10px", color: "var(--ink)" }}>← all screens</Link>
        <span style={{ font: mono(10.5, 700), color: "var(--signal)" }}>{entry.num}</span>
        <span style={{ font: mono(13, 500) }}>{entry.name}</span>
        <span style={{ font: mono(11), color: "var(--mute)" }}>{entry.dim || `${entry.width}px`} · board {entry.board}</span>
      </div>
      <div style={{ maxWidth: 1440, margin: "0 auto", overflowX: "auto" }}>
        <Screen id={entry.id} />
      </div>
    </div>
  );
}
