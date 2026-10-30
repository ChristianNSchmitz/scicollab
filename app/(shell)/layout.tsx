import { redirect } from "next/navigation";
import ChatDock from "@/components/ChatDock";
import DemoNotice from "@/components/DemoNotice";
import Rail from "@/components/Rail";
import SiteFooter from "@/components/SiteFooter";
import TopBar from "@/components/TopBar";
import TabBar from "@/components/TabBar";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/moderation";

/**
 * The navigation shell — board [ 003 ].
 *
 * Desktop 1440×900: top 56, rail 232 (→56), canvas flex, context 320 (→0).
 * Everything inside a route group renders into the canvas.
 */
export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: profile }, moderator] = await Promise.all([
    supabase.from("profiles").select("display_name, institution, avatar_url").eq("id", user.id).maybeSingle(),
    isModerator(supabase, user.id),
  ]);

  const name = profile?.display_name ?? user.email ?? "Researcher";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", background: "var(--bg)" }}>
      <DemoNotice />
      <TopBar name={name} avatarUrl={profile?.avatar_url ?? null} userId={user.id} moderator={moderator} />
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <Rail />
        <main className="sc-main" style={{ flex: 1, minWidth: 0, overflowX: "auto", background: "var(--bg)", display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1 }}>{children}</div>
          <SiteFooter clearDock />
        </main>
      </div>
      <TabBar />
      {/* Docked chat — every screen, per the communication deck. On a phone
          the bottom tabs own that corner, so the dock hides itself there and
          Messages in the tab bar is the way in. */}
      <ChatDock />
    </div>
  );
}
