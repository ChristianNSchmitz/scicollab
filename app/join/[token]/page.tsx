import Link from "next/link";
import PublicPage, { p } from "@/components/PublicPage";
import { createClient } from "@/lib/supabase/server";
import { peekInvite } from "@/lib/social/invites";
import { acceptInvite } from "@/app/actions/groups";
import { ROLE_LABEL, type GroupRole } from "@/lib/social/groups";
import { btn, btnPrimary } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Join a group · SciCollab", robots: { index: false } };

/**
 * Where an invitation link lands. Signed in: one button to join. Not yet a
 * member of SciCollab: create an account (the invitation counts as the
 * invite code) or sign in, and come back here.
 */
export default async function Join({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ error?: string }> }) {
  const { token } = await params;
  const { error } = await searchParams;
  const inv = await peekInvite(token);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
  const here = `/join/${token}`;

  if (!inv || !inv.valid || error === "invalid") {
    return (
      <PublicPage eyebrow="INVITATION" title="This invitation does not work any more">
        <p style={p}>It may have expired, been used up, or been withdrawn. Ask whoever sent it for a new link.</p>
        <p style={p}><Link href={user ? "/groups" : "/"} style={{ color: "var(--link)" }}>{user ? "Browse groups" : "Go to SciCollab"}</Link></p>
      </PublicPage>
    );
  }

  const role = ROLE_LABEL[inv.role as GroupRole]?.toLowerCase() ?? "member";
  return (
    <PublicPage eyebrow="INVITATION" title={`Join ${inv.name}`} lede={`You are invited as a ${role}. Members see the group's discussions, members and shared projects, and can join those projects.`}>
      {user ? (
        <form action={acceptInvite.bind(null, token)}>
          <button type="submit" style={{ ...btnPrimary, height: 44 }}>Join {inv.name}</button>
        </form>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link href={`/signup?invite=${encodeURIComponent(token)}`} style={{ ...btnPrimary, height: 44 }}>Create an account and join</Link>
          <Link href={`/login?next=${encodeURIComponent(here)}`} style={{ ...btn, height: 44 }}>I have an account: sign in</Link>
        </div>
      )}
    </PublicPage>
  );
}
