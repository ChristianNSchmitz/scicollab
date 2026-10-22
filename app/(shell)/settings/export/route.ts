import { createClient } from "@/lib/supabase/server";
import { readAuthor, readPublications } from "@/lib/openalex/store";

export const dynamic = "force-dynamic";

/**
 * "Download your data" (GDPR art. 15 and 20): everything SciCollab holds
 * that you wrote or that is about you, as one JSON file. Read through your
 * own session, so row-level security decides what is included, and the
 * synced OpenAlex record through the same store the profile page uses.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Sign in first.", { status: 401 });
  const id = user.id;

  const rows = async (table: string, column: string) => {
    const { data, error } = await supabase.from(table).select("*").eq(column, id);
    return error ? [] : data ?? [];
  };

  const [profile, cards, questions, answers, posts, replies, sent, received, projects, memberships, entries, datasets, rooms, requests, author, publications] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle().then((r) => r.data),
      rows("method_cards", "author_id"),
      rows("questions", "author_id"),
      rows("answers", "author_id"),
      rows("posts", "author_id"),
      rows("post_replies", "author_id"),
      rows("messages", "sender_id"),
      rows("messages", "recipient_id"),
      rows("projects", "owner_id"),
      rows("project_members", "user_id"),
      rows("eln_entries", "author_id"),
      rows("datasets", "owner_id"),
      rows("user_rooms", "user_id"),
      rows("access_requests", "requester_id"),
      readAuthor(id),
      readPublications(id),
    ]);

  const body = {
    exported_at: new Date().toISOString(),
    account: { id, email: user.email ?? null, created_at: user.created_at ?? null },
    profile,
    method_cards: cards, questions, answers, posts, post_replies: replies,
    messages: { sent, received },
    projects_owned: projects, project_memberships: memberships, notebook_entries: entries, datasets,
    rooms_joined: rooms, access_requests_made: requests,
    openalex: { author, publications },
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="scicollab-my-data-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
