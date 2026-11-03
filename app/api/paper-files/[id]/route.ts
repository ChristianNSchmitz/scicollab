import { NextResponse } from "next/server";
import { sessionUser } from "@/lib/session";
import { isRowId } from "@/lib/query";
import { isConfigured } from "@/lib/mode";
import { loadPaper, PAPER_FILE_BUCKET } from "@/lib/papers";

/**
 * A paper's full text: the shareable version for everyone signed in; a
 * private copy for its authors and for people whose request an author
 * accepted. The database enforces the same (supabase/21); the check here
 * also covers the demo store, which has no policies.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await sessionUser();
  if (!user) return new NextResponse("Sign in first.", { status: 401 });
  if (!isRowId(id)) return new NextResponse("Not found.", { status: 404 });
  const { data: f } = await supabase.from("paper_files").select("work_id, name, path, access").eq("id", id).maybeSingle();
  if (!f) return new NextResponse("Not found.", { status: 404 });
  if (f.access !== "public") {
    const paper = await loadPaper(supabase, f.work_id);
    const { data: r } = await supabase.from("paper_requests").select("status").eq("work_id", f.work_id).eq("requester_id", user.id).maybeSingle();
    if (!paper?.authorIds.includes(user.id) && r?.status !== "sent") return new NextResponse("Not found.", { status: 404 });
  }
  if (isConfigured()) {
    const { data } = await supabase.storage.from(PAPER_FILE_BUCKET).createSignedUrl(f.path, 60);
    if (!data?.signedUrl) return new NextResponse("Not found.", { status: 404 });
    return NextResponse.redirect(data.signedUrl, 302);
  }
  const m = /^data:application\/pdf;base64,(.*)$/.exec(f.path);
  if (!m) return new NextResponse("Not found.", { status: 404 });
  return new NextResponse(Buffer.from(m[1], "base64"), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(f.name)}`,
      "Content-Security-Policy": "sandbox", "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    },
  });
}
