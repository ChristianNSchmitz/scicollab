import { redirect } from "next/navigation";
import DemoNotice from "@/components/DemoNotice";
import Screen from "@/components/Screen";
import { createClient } from "@/lib/supabase/server";
import { isConfigured } from "@/lib/mode";

/** Public front door — board B1 screen 1, rendered as designed with its own
 *  controls wired to the real routes. */
export default async function Landing() {
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
      <div style={{ padding: 24 }}>
      <div style={{ width: 1440, margin: "0 auto" }}>
        <Screen
          id="b1-marketing-landing-page"
          links={{
            "Sign in": "/login",
            "Create account": "/signup",
            "Connect ORCID → start": "/signup",
            "Book a lab pilot": "/signup",
            "Method cards": "/login",
            "Pricing": "/login",
            "Docs": "/login",
          }}
        />
        </div>
      </div>
    </div>
  );
}
