import Link from "next/link";
import PublicPage, { p } from "@/components/PublicPage";
import { requestPasswordReset } from "@/app/actions/password";
import { field, fieldLabel, btnPrimary } from "@/components/ui";

export const metadata = { title: "Reset your password · SciCollab" };

/** Ask for a password-reset link. The answer is the same whether or not the address has an account. */
export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const { sent, error } = await searchParams;
  return (
    <PublicPage eyebrow="ACCOUNT" title="Reset your password" lede="Enter the e-mail address you signed up with. We send a link that lets you choose a new password.">
      {sent === "1" ? (
        <p role="status" style={p}>
          If an account exists for that address, a link is on its way. It works once and for an hour.
          Nothing arrived? Check the spam folder, or <Link href="/forgot-password" style={{ color: "var(--link)" }}>try again</Link>.
        </p>
      ) : sent === "demo" ? (
        <p role="status" style={p}>
          This preview runs without e-mail, so no link can be sent. The demo sign-ins and their passwords are listed in the README;
          the shared one is demo@scicollab.test with the password &ldquo;reproduce&rdquo;.
        </p>
      ) : (
        <form action={requestPasswordReset} style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 420 }}>
          {error === "email" && <p role="alert" style={{ ...p, color: "var(--err)", margin: 0 }}>That does not look like an e-mail address.</p>}
          {error === "link" && <p role="alert" style={{ ...p, color: "var(--err)", margin: 0 }}>That link has expired or was already used. Ask for a new one.</p>}
          <div>
            <label style={fieldLabel} htmlFor="email">E-mail</label>
            <input id="email" name="email" type="email" required autoComplete="email" style={field} />
          </div>
          <div><button type="submit" style={btnPrimary}>Send the link</button></div>
        </form>
      )}
      <p style={{ ...p, marginTop: 20 }}><Link href="/login" style={{ color: "var(--link)" }}>Back to sign in</Link></p>
    </PublicPage>
  );
}
