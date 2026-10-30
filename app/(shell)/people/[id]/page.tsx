import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isRowId } from "@/lib/query";
import { loadProfile } from "@/lib/social/profile";
import { coauthorsOf } from "@/lib/social/coauthors";
import { followingOf } from "@/lib/social/follows";
import { activityOf } from "@/lib/social/activity";
import ProfileBody, { ProfileHead } from "@/components/social/ProfileBody";
import FollowButton from "@/components/social/FollowButton";
import ReportButton from "@/components/ReportButton";
import ActivityList from "@/components/social/ActivityList";
import Avatar from "@/components/Avatar";
import { Panel, PanelHead, Tag, btn, mono } from "@/components/ui";

export const dynamic = "force-dynamic";

/** A member's profile: who they are, what they recorded, answered and
 *  published, the groups they are in and what they did lately. */
export default async function Person({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isRowId(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const me = user!.id;

  const [d, myFollows, { data: followsMe }] = await Promise.all([
    loadProfile(supabase, id, me),
    followingOf(supabase, me),
    supabase.from("follows").select("follower_id").eq("follower_id", id).eq("followee_id", me).maybeSingle(),
  ]);
  if (!d) notFound();
  const isMe = id === me;

  const [co, activity] = await Promise.all([
    coauthorsOf(supabase, id, d.person.orcid, myFollows),
    activityOf(supabase, [id], { viewer: me, limit: 8 }),
  ]);
  const coMembers = co.members.filter((m) => m.person.id !== me);

  return (
    <div style={{ padding: "24px 16px 64px" }}>
      <div style={{ maxWidth: "var(--content-max)", margin: "0 auto" }}>
        <ProfileHead d={d} actions={
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {isMe ? (
              <>
                <Link href="/settings#profile" style={btn}>Edit profile</Link>
                <Link href="/you" style={btn}>Your record</Link>
              </>
            ) : (
              <>
                {followsMe && <Tag>follows you</Tag>}
                <FollowButton personId={id} following={myFollows.has(id)} />
                <Link href={`/messages/${id}`} style={btn}>Message</Link>
                <ReportButton kind="profile" targetId={id} label="Report" />
              </>
            )}
          </div>
        } />
        {isMe && (
          <p style={{ font: "400 13px/1.6 var(--sans)", color: "var(--mute)", margin: "-6px 0 14px" }}>
            This is how other members see you. {d.person.public_profile
              ? "Your profile is also visible to visitors who are not signed in."
              : <>Only signed-in members can see it; you can <Link href="/settings#privacy" style={{ color: "var(--link)" }}>make it public</Link>.</>}
          </p>
        )}
        <ProfileBody d={d} side={
          <>
            <Panel>
              <PanelHead>Recent activity</PanelHead>
              <ActivityList items={activity} compact empty="Nothing in the last 60 days." />
            </Panel>
            {coMembers.length > 0 && (
              <Panel>
                <PanelHead>Co-authors on SciCollab</PanelHead>
                {coMembers.slice(0, 6).map((m) => (
                  <div key={m.person.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 14px", borderBottom: "1px solid var(--rule)" }}>
                    <Avatar name={m.person.display_name} url={m.person.avatar_url} size={26} />
                    <Link href={`/people/${m.person.id}`} style={{ flex: 1, font: mono(12.5, 500), color: "var(--ink)" }}>{m.person.display_name}</Link>
                    <span style={{ font: mono(10.5), color: "var(--mute)" }}>{m.papers} paper{m.papers > 1 ? "s" : ""}</span>
                  </div>
                ))}
              </Panel>
            )}
          </>
        } />
      </div>
    </div>
  );
}
