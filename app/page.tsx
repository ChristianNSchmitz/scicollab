import { redirect } from "next/navigation";
import DemoNotice from "@/components/DemoNotice";
import Link from "next/link";
import Screen from "@/components/Screen";
import { btn, btnPrimary, mono } from "@/components/ui";
import SiteFooter from "@/components/SiteFooter";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/mode";

/** Public front door — board B1 screen 1, rendered as designed with its own
 *  controls wired to the real routes. */
export default async function Landing({ searchParams }: { searchParams: Promise<{ deleted?: string }> }) {
  const { deleted } = await searchParams;
  // The front door is the one page that has to render even when the backend
  // is missing or asleep. A signed-in visitor is sent onward; anything going
  // wrong in that check falls through to the public page rather than a 500.
  if (isConfigured()) {
    let signedIn = false;
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      signedIn = Boolean(user);
    } catch {
      signedIn = false;
    }
    if (signedIn) redirect("/home");
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)" }}>
      <DemoNotice />
      {deleted && (
        <p role="status" style={{ margin: 0, padding: "10px 16px", font: "400 14px/1.5 var(--sans)", background: "var(--surface)", borderBottom: "1px solid var(--rule)", textAlign: "center" }}>
          Your account and everything that belonged to it have been deleted.
        </p>
      )}
      <MobileLanding />
      <div className="sc-land-board" style={{ padding: 24, overflowX: "auto" }}>
      <div style={{ width: 1440, margin: "0 auto" }}>
        <Screen
          id="b1-marketing-landing-page"
          hideCoverage
          links={{
            "Sign in": "/login",
            "Create account": "/signup",
            "Connect ORCID → start": "/signup",
            "Book a lab pilot": "/signup",
            "Talk to us about a pilot": "/contact?topic=pilot",
            "Method cards": "/login",
            "Pricing": "/login",
            "Docs": "/login",
          }}
        />
        <SiteFooter width={1440} />
        </div>
      </div>
    </div>
  );
}

/** The board is a fixed 1440px artboard, which a phone can only show a strip
 *  of. Below 760px the same message is set in the house kit instead, so the
 *  front door still reads and both ways in stay on screen. */
function MobileLanding() {
  const point = (t: string) => (
    <li style={{ display: "flex", gap: 8, font: "400 14px/1.55 var(--sans)" }}>
      <span style={{ color: "var(--signal-ink)" }}>→</span><span>{t}</span>
    </li>
  );
  return (
    <div className="sc-land-mobile" style={{ padding: "18px 16px 40px", background: "var(--bg)", minHeight: "100vh" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <span style={{ font: mono(17, 700), marginRight: "auto" }}>scicollab<span style={{ color: "var(--signal-ink)" }}>/</span></span>
        <Link href="/login" style={btn}>Sign in</Link>
      </div>
      <div style={{ font: mono(10, 700), letterSpacing: ".1em", color: "var(--signal-ink)", marginBottom: 12 }}>
        GITHUB × STACK OVERFLOW × DATABASE, FOR SCIENTISTS
      </div>
      <h1 style={{ font: mono(30, 700, 1.12), letterSpacing: "-.03em", margin: "0 0 14px" }}>
        A failed experiment nobody wrote down gets repeated.
      </h1>
      <p style={{ font: "400 15px/1.6 var(--sans)", color: "var(--mute)", margin: "0 0 20px" }}>
        Somewhere else. By someone junior. Next month. SciCollab keeps the data, the code, the conditions
        and the argument in one place — including the runs that didn&apos;t work.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Link href="/signup" style={{ ...btnPrimary, height: 44, justifyContent: "center" }}>Connect ORCID → start</Link>
        <Link href="/signup" style={{ ...btn, height: 44, justifyContent: "center" }}>Book a lab pilot</Link>
      </div>
      <p style={{ font: mono(11), color: "var(--mute)", margin: "12px 0 28px" }}>
        Free for individual researchers · institutional pilots start at one lab
      </p>
      <ul style={{ listStyle: "none", padding: "18px 0 0", margin: 0, borderTop: "1px solid var(--rule)", display: "flex", flexDirection: "column", gap: 10 }}>
        {point("Ask with the data attached, not a paraphrase of it")}
        {point("Find the prior failure before you fund the repeat")}
        {point("Negative and null results as citable, reusable objects")}
        {point("Method cards: structured, versioned, forkable, and explicit about when a method fails")}
      </ul>
    </div>
  );
}
