"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createAccount } from "@/app/actions/signup";
import { demoSignUp, backendConfigured } from "@/app/actions/demo-auth";

/** Account creation. Board B1 screens 2–3 put ORCID and institutional SSO
 *  first; neither is connected, so the provider choice is shown as designed
 *  and email is the live path. */
export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);

    if (!(await backendConfigured())) {
      const res = await demoSignUp(email.trim(), password, name.trim(), institution.trim());
      setBusy(false);
      if (!res.ok) { setError(res.error); return; }
      router.push("/home");
      router.refresh();
      return;
    }

    // Creation happens server-side so the invite code cannot be bypassed.
    const form = new FormData();
    form.set("display_name", name.trim());
    form.set("institution", institution.trim());
    form.set("email", email.trim());
    form.set("password", password);
    form.set("invite", invite.trim());

    const result = await createAccount(form);
    if (!result.ok) { setBusy(false); setError(result.error); return; }

    const { error: signInError } = await createClient().auth.signInWithPassword({
      email: email.trim(), password,
    });
    setBusy(false);
    if (signInError) { setError("Account created. Please sign in."); return; }

    router.push("/home");
    router.refresh();
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 520, background: "var(--surface)", border: "1px solid var(--ink)", padding: 32 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "flex-end", marginBottom: 26, color: "var(--ink)" }}>
          <span style={{ position: "relative", font: "700 18px/1 var(--mono)", letterSpacing: "-.03em" }}>
            scicollab
            <span style={{ position: "absolute", left: 0, bottom: -5, width: 12, height: 3, background: "var(--signal)" }} />
          </span>
          <span style={{ font: "700 18px/1 var(--mono)", color: "var(--signal)" }}>/</span>
        </Link>

        <h1 style={{ font: "700 20px/1.2 var(--mono)", margin: "0 0 6px", letterSpacing: "-.02em" }}>Create your account</h1>
        <p style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", margin: "0 0 20px" }}>
          Free for individual researchers · institutional pilots start at one lab
        </p>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <button type="button" disabled title="Designed on board B1, not connected" style={provider}>
            Connect ORCID
            <em style={soon}>not wired</em>
          </button>
          <button type="button" disabled title="Designed on board I1, not connected" style={provider}>
            Institutional SSO
            <em style={soon}>not wired</em>
          </button>
        </div>

        <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <label style={label}>
            <span style={labelText}>Full name — as it appears on your publications</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} style={input} placeholder="Alex Rivera" />
          </label>
          <label style={label}>
            <span style={labelText}>Institution</span>
            <input value={institution} onChange={(e) => setInstitution(e.target.value)} style={input} placeholder="KU Leuven" />
          </label>
          <label style={label}>
            <span style={labelText}>Email</span>
            <input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setError(""); }} style={input} placeholder="a.rivera@institution.edu" />
          </label>
          <label style={label}>
            <span style={labelText}>Password — at least 8 characters</span>
            <input type="password" required value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} style={input} placeholder="••••••••" />
          </label>

          <label style={label}>
            <span style={labelText}>Invite code</span>
            <input value={invite} onChange={(e) => { setInvite(e.target.value); setError(""); }} style={input} placeholder="This build is invite-only" />
          </label>

          {error && (
            <p style={{ font: "400 11px/1.5 var(--mono)", color: "var(--err)", border: "1px solid var(--err)", padding: "8px 10px", margin: 0 }}>{error}</p>
          )}

          <button type="submit" disabled={busy} style={primary}>
            {busy ? "Creating…" : "Create account"}
          </button>
        </form>

        <p style={{ font: "400 11px/1.6 var(--mono)", color: "var(--mute)", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rule)" }}>
          Already have one? <Link href="/login" style={{ color: "var(--link)" }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const labelText: React.CSSProperties = { font: "500 10px/1 var(--mono)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)" };
const input: React.CSSProperties = { height: 38, padding: "0 10px", border: "1px solid var(--rule)", background: "var(--bg)", font: "400 13px/1 var(--mono)", color: "var(--ink)" };
const primary: React.CSSProperties = { height: 42, background: "var(--signal)", color: "#fff", border: "1px solid var(--signal)", font: "500 13px/1 var(--mono)", cursor: "pointer", marginTop: 4 };
const provider: React.CSSProperties = { flex: 1, height: 44, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, border: "1px solid var(--rule)", background: "var(--bg)", font: "500 12px/1 var(--mono)", color: "var(--mute)", cursor: "not-allowed" };
const soon: React.CSSProperties = { font: "400 9px/1 var(--mono)", fontStyle: "normal", letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mute)", opacity: .7 };
