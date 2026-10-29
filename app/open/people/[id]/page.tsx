import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { publicReader } from "@/lib/showcase";
import { isRowId } from "@/lib/query";
import { loadProfile } from "@/lib/social/profile";
import PublicPage from "@/components/PublicPage";
import ProfileBody from "@/components/social/ProfileBody";
import Avatar from "@/components/Avatar";
import { btn, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * A profile as signed-out visitors see it (proxy.ts sends them here from
 * /people/[id]). Only for people who turned "show my profile publicly" on in
 * Settings, and only their public work; everyone else is a 404, so a
 * private profile cannot even be confirmed to exist.
 */
const load = cache(async (id: string) => {
  const db = publicReader();
  if (!db || !isRowId(id)) return null;
  return loadProfile(db, id, null);
});

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const d = await load((await params).id);
  if (!d) return { title: "SciCollab", robots: { index: false } };
  const p = d.person;
  const line = [p.role_title, p.institution].filter(Boolean).join(", ");
  const description = (p.bio || `${p.display_name}${line ? `, ${line}` : ""}, on SciCollab.`).slice(0, 200);
  return {
    title: `${p.display_name} · SciCollab`,
    description,
    openGraph: { title: p.display_name, description, type: "profile", siteName: "SciCollab" },
    twitter: { card: "summary", title: p.display_name, description },
  };
}

export default async function OpenProfile({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const d = await load(id);
  if (!d) notFound();
  const p = d.person;
  return (
    <PublicPage
      eyebrow="RESEARCHER ON SCICOLLAB"
      title={p.display_name}
      lede={[p.role_title, p.institution, p.field].filter(Boolean).join(" · ") || undefined}
    >
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", margin: "-10px 0 18px" }}>
        <Avatar name={p.display_name} url={p.avatar_url} size={56} />
        <span style={{ flex: 1 }} />
        <Link href={`/login?next=${encodeURIComponent(`/people/${id}`)}`} style={btn}>Sign in to follow</Link>
        <Link href="/signup" style={btnPrimary}>Join SciCollab</Link>
      </div>
      <ProfileBody d={d} publicView />
    </PublicPage>
  );
}
