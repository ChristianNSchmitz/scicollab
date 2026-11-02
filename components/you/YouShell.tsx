import Link from "next/link";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/server";
import { openToLabel } from "@/lib/taxonomy";
import Avatar from "@/components/Avatar";
import SegTabs from "@/components/SegTabs";

/**
 * Your own space, one header for four tabs: Activity, Record, Publications
 * and Saved. Who you are and what you are open to sit in the header, so the
 * tabs below only hold their own content.
 */
export type YouTab = "activity" | "record" | "publications" | "saved";

const TABS: { id: YouTab; label: string; href: string }[] = [
  { id: "activity", label: "Activity", href: "/you" },
  { id: "record", label: "Record", href: "/you/record" },
  { id: "publications", label: "Publications", href: "/you/publications" },
  { id: "saved", label: "Saved", href: "/you/saved" },
];

export default async function YouShell({ active, children }: { active: YouTab; children: ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from("profiles").select("display_name, role_title, institution, avatar_url, open_to").eq("id", user!.id).maybeSingle();
  const openTo = (p?.open_to ?? []) as string[];
  return (
    <div style={{ padding: "24px 16px 64px" }}>
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
        <header className="sc-page-head" style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
          <Avatar name={p?.display_name ?? ""} url={p?.avatar_url ?? null} size={56} />
          <div style={{ flex: "1 1 260px", minWidth: 0 }}>
            <h1 className="sc-title" style={{ font: "700 24px/1.2 var(--sans)", letterSpacing: "-.02em", margin: 0 }}>{p?.display_name || "You"}</h1>
            <p style={{ font: "400 13.5px/1.5 var(--sans)", color: "var(--mute)", margin: "4px 0 0" }}>
              {[p?.role_title, p?.institution].filter(Boolean).join(" · ") || "Add your role and institution in Settings."}
              {openTo.length > 0 && <> · Open to {openTo.map((o) => openToLabel(o).toLowerCase()).join(", ")}</>}
            </p>
          </div>
          <Link href="/settings#profile" style={{ height: 34, padding: "0 14px", borderRadius: 999, border: "1px solid var(--rule)", background: "var(--surface)", display: "flex", alignItems: "center", font: "600 13px/1 var(--sans)", color: "var(--ink)", textDecoration: "none" }}>Edit profile</Link>
        </header>
        <SegTabs label="Your pages" items={TABS.map((t) => ({ href: t.href, label: t.label, active: t.id === active }))} />
        {children}
      </div>
    </div>
  );
}
