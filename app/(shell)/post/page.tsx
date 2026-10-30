import { createClient } from "@/lib/supabase/server";
import { roomById } from "@/lib/taxonomy";
import PostComposer from "@/components/PostComposer";
import { Page } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Compose({
  searchParams,
}: { searchParams: Promise<{ room?: string; intent?: string; card?: string }> }) {
  const { room, intent, card } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: mine }, { data: cards }, { data: memberships }] = await Promise.all([
    supabase.from("user_rooms").select("room_id").eq("user_id", user!.id),
    supabase.from("method_cards").select("id, code, title").eq("author_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("project_members").select("project_id").eq("user_id", user!.id),
  ]);

  // Evidence you can attach: the data and code in projects you are on.
  const projectIds = (memberships ?? []).map((m: { project_id: string }) => m.project_id);
  const [{ data: projects }, { data: datasets }, { data: codeFiles }] = projectIds.length
    ? await Promise.all([
        supabase.from("projects").select("id, title").in("id", projectIds),
        supabase.from("datasets").select("id, title, project_id, size_bytes").in("project_id", projectIds),
        supabase.from("code_files").select("id, path, project_id, language").in("project_id", projectIds),
      ])
    : [{ data: [] as any[] }, { data: [] as any[] }, { data: [] as any[] }];

  const titleOf = (pid: string) => (projects ?? []).find((x: any) => x.id === pid)?.title ?? "Project";
  const attachables = [
    ...(datasets ?? []).map((d: any) => ({ value: `dataset:${d.id}`, project: titleOf(d.project_id), label: d.title, kind: "Data" })),
    ...(codeFiles ?? []).map((f: any) => ({ value: `code:${f.id}`,  project: titleOf(f.project_id), label: f.path,  kind: "Code" })),
  ].sort((a, b) => a.project.localeCompare(b.project) || a.label.localeCompare(b.label));

  const rooms = (mine ?? [])
    .map((r: { room_id: string }) => roomById(r.room_id))
    .filter(Boolean)
    .map((r) => ({ id: r!.id, name: r!.name }));

  return (
    <Page title="New post" lede="Pick what kind of post this is. It decides how the topic group can filter it, and whether it has to carry evidence.">
      <PostComposer
        rooms={rooms}
        cards={(cards ?? []) as { id: string; code: string; title: string }[]}
        defaultRoom={room}
        defaultIntent={intent}
        defaultCard={card}
        attachables={attachables}
      />
    </Page>
  );
}
