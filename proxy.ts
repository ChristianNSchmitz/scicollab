import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Next 16 replaces middleware.ts with proxy.ts. Refreshes the Supabase
 *  session cookie on every request and gates the authed routes. */
/* The design boards are an internal review — pricing strategy, the refused
   mechanics, the coverage audit and the open questions are all in there. They
   stay open in development and require a session anywhere else. */
// /api/cron checks its own secret; it has no session to offer.
const PUBLIC = [
  "/", "/login", "/signup", "/onboarding", "/api/cron",
  // Password reset: the request form and the link back from the e-mail.
  "/forgot-password", "/auth/callback",
  // Group invitation links: readable signed out, so a new person can sign up from them.
  "/join",
  // Public information pages and the contact form (with its captcha).
  "/about", "/faq", "/terms", "/contact", "/api/captcha",
  // The front page's live "most active" list: public items only (lib/showcase.ts).
  "/api/showcase",
  // Public profiles and method cards, for visitors (app/open/*).
  "/open",
];

/* A signed-out visitor following a link to a profile or a method card gets
   the public version at the same address, instead of the sign-in page. The
   public page itself decides what is public (404 otherwise). */
const SHAREABLE = /^\/(people|methods)\/([A-Za-z0-9-]{1,64})$/;
function openVersion(request: NextRequest) {
  const m = request.nextUrl.pathname.match(SHAREABLE);
  if (!m || m[2] === "new") return null;
  const to = request.nextUrl.clone();
  to.pathname = `/open/${m[1]}/${m[2]}`;
  return NextResponse.rewrite(to);
}
if (process.env.NODE_ENV !== "production" || process.env.SCICOLLAB_OPEN_BOARDS === "1") {
  PUBLIC.push("/boards");
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  if (!url || url.includes("placeholder")) {
    // Without a backend there is no session to check. In development that
    // should not stand in the way; in production it must not fail open, or a
    // misconfigured deploy silently publishes everything behind the gate.
    if (!request.cookies.get("sc-demo")) { const open = openVersion(request); if (open) return open; }
    if (process.env.NODE_ENV !== "production" || isPublic) return response;
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    return NextResponse.redirect(to);
  }

  const supabase = createServerClient(
    url,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // getClaims() verifies the session token locally (with asymmetric signing
  // keys) instead of a round trip to Supabase Auth on every request,
  // prefetches included, and still refreshes an expired session. With a
  // legacy symmetric secret it falls back to asking the Auth server.
  // Pages and actions still confirm the user with getUser() before writing.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ?? null;
  if (!user) { const open = openVersion(request); if (open) return open; }
  if (!user && !isPublic) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.searchParams.set("next", pathname);
    return NextResponse.redirect(to);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
