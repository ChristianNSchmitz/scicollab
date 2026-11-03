// Stands in for "@/lib/supabase/server" inside app/auth/callback/route.ts only:
// any code is accepted, so the test can watch where the user is sent next.
export async function createClient() {
  return { auth: { async exchangeCodeForSession(code) {
    return code === "bad" ? { data: { user: null }, error: new Error("bad code") } : { data: { user: { id: "u-lena" } }, error: null };
  } } };
}
