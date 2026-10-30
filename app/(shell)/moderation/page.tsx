import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/moderation";
import { peopleById } from "@/lib/people";
import { closeReport, removeReported } from "@/app/actions/moderation";
import { Page, Panel, PanelHead, Empty, Tag, btn, field, mono } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  spam: "Spam or advertising", abuse: "Harassment or abuse", misconduct: "Possible research misconduct",
  "personal-data": "Personal or patient data", other: "Something else",
};
const small = { ...btn, height: 30, padding: "0 12px" };

type Target = { title: string; text: string; author: string | null; href: string | null; gone: boolean };

/**
 * The moderation inbox: what members reported, with the reported content
 * next to it, and three ways to close a report: remove the content, mark
 * it handled, or dismiss it. Only moderators (supabase/11) reach this page.
 */
export default async function Moderation({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!(await isModerator(supabase, user!.id))) notFound();
  const closed = show === "closed";

  let q = supabase.from("reports").select("*").order("created_at", { ascending: !closed }).limit(100);
  q = closed ? q.neq("status", "open") : q.eq("status", "open");
  const [{ data: reports }, { count: openCount }] = await Promise.all([
    q,
    supabase.from("reports").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const list = reports ?? [];
  const ids = (k: string) => list.filter((r: any) => r.target_kind === k).map((r: any) => r.target_id);
  const empty = Promise.resolve({ data: [] as any[] });
  const [{ data: posts }, { data: replies }, { data: answers }, { data: questions }] = await Promise.all([
    ids("post").length ? supabase.from("posts").select("id, title, body, author_id, group_id").in("id", ids("post")) : empty,
    ids("reply").length ? supabase.from("post_replies").select("id, body, author_id, post_id").in("id", ids("reply")) : empty,
    ids("answer").length ? supabase.from("answers").select("id, body, author_id, question_id").in("id", ids("answer")) : empty,
    ids("question").length ? supabase.from("questions").select("id, title, body, author_id").in("id", ids("question")) : empty,
  ]);
  const people = await peopleById(supabase, [
    ...list.map((r: any) => r.reporter_id), ...list.map((r: any) => r.resolved_by), ...ids("profile"),
    ...[...(posts ?? []), ...(replies ?? []), ...(answers ?? []), ...(questions ?? [])].map((x: any) => x.author_id),
  ]);
  const name = (id?: string | null) => (id ? people.get(id)?.display_name ?? "Someone" : null);

  const target = (r: any): Target => {
    const find = (rows: any[] | null) => (rows ?? []).find((x: any) => x.id === r.target_id);
    switch (r.target_kind) {
      case "post": { const x = find(posts); return x ? { title: x.title, text: x.body ?? "", author: name(x.author_id), href: `/posts/${x.id}`, gone: false } : gone(); }
      case "reply": { const x = find(replies); return x ? { title: "Reply", text: x.body, author: name(x.author_id), href: `/posts/${x.post_id}#reply-${x.id}`, gone: false } : gone(); }
      case "answer": { const x = find(answers); return x ? { title: "Answer", text: x.body, author: name(x.author_id), href: `/questions/${x.question_id}#answer-${x.id}`, gone: false } : gone(); }
      case "question": { const x = find(questions); return x ? { title: x.title, text: x.body ?? "", author: name(x.author_id), href: `/questions/${x.id}`, gone: false } : gone(); }
      case "profile": case "message": { const p = people.get(r.target_id); return { title: p ? `Person: ${p.display_name}` : "Person", text: p?.institution ?? "", author: null, href: `/people/${r.target_id}`, gone: !p }; }
      default: return gone();
    }
  };

  return (
    <Page
      title="Moderation"
      lede="Reports from members, oldest first, with the reported content next to each. Remove what breaks the house rules, close what was handled, dismiss what needs nothing."
      actions={
        <nav aria-label="Reports" className="sc-seg" style={{ display: "flex" }}>
          <Link href="/moderation" aria-current={!closed ? "page" : undefined} style={{ padding: "8px 14px", font: mono(12, 600), color: "var(--ink)" }}>Open · {openCount ?? 0}</Link>
          <Link href="/moderation?show=closed" aria-current={closed ? "page" : undefined} style={{ padding: "8px 14px", font: mono(12, 600), color: "var(--ink)" }}>Closed</Link>
        </nav>
      }
    >
      {list.length === 0 && <Panel><Empty>{closed ? "No closed reports yet." : "Nothing to review. Well done, community."}</Empty></Panel>}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 900 }}>
        {list.map((r: any) => {
          const t = target(r);
          const removable = ["post", "reply", "answer", "question"].includes(r.target_kind) && !t.gone;
          return (
            <Panel key={r.id}>
              <PanelHead>{REASON[r.reason] ?? r.reason} · {r.target_kind} · reported by {name(r.reporter_id)} · {timeAgo(r.created_at)}</PanelHead>
              <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
                {r.note && <p style={{ margin: 0, font: "400 13.5px/1.55 var(--sans)" }}><strong style={{ fontWeight: 600 }}>Note:</strong> {r.note}</p>}
                <div className="sc-soft" style={{ border: "1px solid var(--rule)", background: "var(--bg)", padding: "10px 12px" }}>
                  {t.gone ? (
                    <span style={{ font: "400 13px/1.5 var(--sans)", color: "var(--mute)" }}>The reported content no longer exists.</span>
                  ) : (
                    <>
                      <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                        <span style={{ font: "600 14px/1.4 var(--sans)" }}>{t.title}</span>
                        {t.author && <span style={{ font: "400 12.5px/1.4 var(--sans)", color: "var(--mute)" }}>by {t.author}</span>}
                        {t.href && <Link href={t.href} style={{ marginLeft: "auto", font: "500 12.5px/1 var(--sans)", color: "var(--link)" }}>Open →</Link>}
                      </div>
                      {t.text && <p style={{ margin: "6px 0 0", font: "400 13.5px/1.55 var(--sans)", whiteSpace: "pre-wrap" }}>{t.text.slice(0, 600)}{t.text.length > 600 ? "…" : ""}</p>}
                    </>
                  )}
                </div>
                {closed ? (
                  <div style={{ font: "400 12.5px/1.5 var(--sans)", color: "var(--mute)" }}>
                    <Tag>{r.status}</Tag> by {name(r.resolved_by) ?? "a moderator"}{r.resolved_at ? `, ${timeAgo(r.resolved_at)}` : ""}{r.resolution ? `: ${r.resolution}` : ""}
                  </div>
                ) : (
                  <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                    <label htmlFor={`note-${r.id}`} style={{ position: "absolute", left: -9999 }}>Note on what you did</label>
                    <input id={`note-${r.id}`} name="note" maxLength={500} placeholder="What you did (optional, for the other moderators)" style={{ ...field, flex: "1 1 260px", width: "auto", height: 30 }} />
                    {removable && <button formAction={removeReported.bind(null, r.id)} style={{ ...small, borderColor: "var(--err)", color: "var(--err)" }}>Remove content</button>}
                    <button formAction={closeReport.bind(null, r.id, "resolved")} style={small}>Handled</button>
                    <button formAction={closeReport.bind(null, r.id, "dismissed")} style={small}>Dismiss</button>
                  </form>
                )}
              </div>
            </Panel>
          );
        })}
      </div>
    </Page>
  );
}

function gone(): Target {
  return { title: "", text: "", author: null, href: null, gone: true };
}
