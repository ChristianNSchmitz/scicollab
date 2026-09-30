"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { demoSignIn, backendConfigured } from "@/app/actions/demo-auth";

function Form() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/home";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    // With no Supabase project configured the app runs off the demo store.
    if (!(await backendConfigured())) {
      const res = await demoSignIn(email.trim(), password);
      setBusy(false);
      if (!res.ok) { setError(res.error); return; }
      router.push(next);
      router.refresh();
      return;
    }

    const { error } = await createClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (error) {
      setError("That email and password do not match an account.");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={label}>
        <span style={labelText}>Email</span>
        <input
          type="email" autoComplete="email" required value={email}
          onChange={(e) => { setEmail(e.target.value); setError(""); }}
          style={input} placeholder="a.rivera@institution.edu"
        />
      </label>

      <label style={label}>
        <span style={labelText}>Password</span>
        <input
          type="password" autoComplete="current-password" required value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          style={input} placeholder="••••••••"
        />
      </label>

      {error && (
        <p style={{ font: "400 11px/1.5 var(--mono)", color: "var(--err)", border: "1px solid var(--err)", padding: "8px 10px", margin: 0 }}>
          {error}
        </p>
      )}

      <button type="submit" disabled={busy} style={primary}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: 460, background: "var(--surface)", border: "1px solid var(--ink)", padding: 32 }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "flex-end", marginBottom: 26, color: "var(--ink)" }}>
          <span style={{ position: "relative", font: "700 18px/1 var(--mono)", letterSpacing: "-.03em" }}>
            scicollab
            <span style={{ position: "absolute", left: 0, bottom: -5, width: 12, height: 3, background: "var(--signal)" }} />
          </span>
          <span style={{ font: "700 18px/1 var(--mono)", color: "var(--signal)" }}>/</span>
        </Link>

        <h1 style={{ font: "700 20px/1.2 var(--mono)", margin: "0 0 6px", letterSpacing: "-.02em" }}>Sign in</h1>
        <p style={{ font: "400 12px/1.6 var(--sans)", color: "var(--mute)", margin: "0 0 22px" }}>
          Institutional SSO and ORCID are designed on board B1 and are not connected yet — email and password for now.
        </p>

        <Suspense fallback={null}><Form /></Suspense>

        <p style={{ font: "400 11px/1.6 var(--mono)", color: "var(--mute)", marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rule)" }}>
          No account? <Link href="/signup" style={{ color: "var(--link)" }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}

const label: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 6 };
const labelText: React.CSSProperties = { font: "500 10px/1 var(--mono)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mute)" };
const input: React.CSSProperties = { height: 38, padding: "0 10px", border: "1px solid var(--rule)", background: "var(--bg)", font: "400 13px/1 var(--mono)", color: "var(--ink)" };
const primary: React.CSSProperties = { height: 42, background: "var(--signal)", color: "#fff", border: "1px solid var(--signal)", font: "500 13px/1 var(--mono)", cursor: "pointer", marginTop: 4 };
