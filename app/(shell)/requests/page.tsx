import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { decideRequest } from "@/app/actions/attachments";
import { Page, Panel, PanelHead, Empty, Tag, btn, mono } from "@/components/ui";
import Avatar from "@/components/Avatar";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Data access requests — every request on evidence you attached to a post,
 * in one place. Each one is also shown on its post; this is the inbox.
 */
export default async function Requests() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: incoming }, { data: outgoing }] = await Promise.all([
    supabase.from("access_requests").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("access_requests").select("*").eq("requester_id", user!.id).order("created_at", { ascending: false }),
  ]);
  const all = [...(incoming ?? []), ...(outgoing ?? [])];

  const attIds = [...new Set(all.map((r: any) => r.attachment_id))];
  const { data: atts } = attIds.length
    ? await supabase.from("post_attachments").select("id, post_id, kind, dataset_id, code_file_id").in("id", attIds)
    : { data: [] as any[] };
  const dsIds = (atts ?? []).map((a: any) => a.dataset_id).filter(Boolean);
  const cfIds = (atts ?? []).map((a: any) => a.code_file_id).filter(Boolean);
  const postIds = [...new Set((atts ?? []).map((a: any) => a.post_id))];
  const peopleIds = [...new Set(all.flatMap((r: any) => [r.requester_id, r.owner_id]))];
  const [{ data: ds }, { data: cf }, { data: posts }, { data: people }] = await Promise.all([
    dsIds.length ? supabase.from("datasets").select("id, title").in("id", dsIds) : Promise.resolve({ data: [] as any[] }),
    cfIds.length ? supabase.from("code_files").select("id, path").in("id", cfIds) : Promise.resolve({ data: [] as any[] }),
    postIds.length ? supabase.from("posts").select("id, title").in("id", postIds) : Promise.resolve({ data: [] as any[] }),
    peopleIds.length ? supabase.from("profiles").select("id, display_name, institution, avatar_url").in("id", peopleIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const att = (id: string) => (atts ?? []).find((a: any) => a.id === id);
  const what = (a: any) => a?.kind === "dataset"
    ? `Data · ${(ds ?? []).find((d: any) => d.id === a.dataset_id)?.title ?? "dataset"}`
    : `Code · ${(cf ?? []).find((c: any) => c.id === a?.code_file_id)?.path ?? "file"}`;
  const who = (id: string) => (people ?? []).find((p: any) => p.id === id);
  const postTitle = (id: string) => (posts ?? []).find((p: any) => p.id === id)?.title ?? "a post";

  const pending = (incoming ?? []).filter((r: any) => r.status === "pending");
  const decided = (incoming ?? []).filter((r: any) => r.status !== "pending").slice(0, 20);

  const statusTag = (s: string) => (
    <span style={{ font: mono(9.5, 700), letterSpacing: ".08em", padding: "2px 6px", border: "1px solid",
                   color: s === "granted" ? "var(--ok)" : s === "denied" ? "var(--err)" : "var(--mute)" }}>{s.toUpperCase()}</span>
  );

  const row = (r: any, mine: boolean) => {
    const a = att(r.attachment_id);
    const p = who(mine ? r.requester_id : r.owner_id);
    return (
      <div key={r.id} style={{ padding: 14, borderBottom: "1px solid var(--rule)", display: "flex", gap: 12, alignItems: "flex-start" }}>
        <Avatar name={p?.display_name ?? ""} url={p?.avatar_url} size={32} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ font: mono(12.5, 500) }}>{p?.display_name ?? "Someone"}</span>
            {p?.institution && <span style={{ font: mono(10.5), color: "var(--mute)" }}>{p.institution}</span>}
            <span style={{ marginLeft: "auto", font: mono(10.5), color: "var(--mute)" }}>{timeAgo(r.created_at)}</span>
            {r.status !== "pending" && statusTag(r.status)}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Tag>{what(a)}</Tag>
            {a && <Link href={`/posts/${a.post_id}`} style={{ font: mono(11), color: "var(--link)" }}>on “{postTitle(a.post_id)}”</Link>}
          </div>
          {r.message && <p style={{ font: "400 13.5px/1.6 var(--sans)", margin: "8px 0 0" }}>{r.message}</p>}
          {mine && r.status === "pending" && (
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <form action={decideRequest.bind(null, r.id, "granted")}>
                <button type="submit" style={{ ...btn, borderColor: "var(--ok)", color: "var(--ok)" }}>Grant access</button>
              </form>
              <form action={decideRequest.bind(null, r.id, "denied")}>
                <button type="submit" style={{ ...btn, borderColor: "var(--err)", color: "var(--err)" }}>Decline</button>
              </form>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Page title="Access requests" lede="Requests to open data or code you attached to a post, and the ones you made. You approve one researcher at a time.">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Panel>
          <PanelHead>Waiting on you · {pending.length}</PanelHead>
          {pending.length === 0 ? <Empty>No requests waiting.</Empty> : pending.map((r: any) => row(r, true))}
        </Panel>
        <Panel>
          <PanelHead>Your requests · {outgoing?.length ?? 0}</PanelHead>
          {(outgoing?.length ?? 0) === 0 ? <Empty>You have not asked for access to anything yet.</Empty> : outgoing!.map((r: any) => row(r, false))}
        </Panel>
        {decided.length > 0 && (
          <Panel>
            <PanelHead>Decided · {decided.length}</PanelHead>
            {decided.map((r: any) => row(r, true))}
          </Panel>
        )}
      </div>
    </Page>
  );
}
