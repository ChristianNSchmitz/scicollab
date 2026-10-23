import Link from "next/link";

/**
 * The bottom line of the public pages: who we are, the questions people ask,
 * the terms, a way to reach us, and our social pages.
 *
 * Fixed dark, like the "Science made easy" band on the landing page it sits
 * under, so it reads the same in both themes.
 *
 * The Facebook and LinkedIn pages do not exist yet: the icons point nowhere
 * ("#") until they do. Replace SOCIAL below with the real addresses.
 */
const SOCIAL = {
  facebook: "#",
  linkedin: "#",
};

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/faq", label: "Questions" },
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/contact", label: "Contact" },
];

export default function SiteFooter({ width, clearDock = false }: {
  width?: number;
  /** Inside the signed-in app the chat is docked bottom-right: leave room so it never covers the icons. */
  clearDock?: boolean;
}) {
  return (
    <footer
      className={clearDock ? "sc-footer-dock" : undefined}
      style={{
        width: width ?? "100%", maxWidth: "100%", margin: "0 auto",
        background: "#0D0D0D", color: "#8E8B85",
        borderTop: "1px solid #2E2C29",
        padding: "14px 16px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px 22px",
        font: "400 11px/1.4 var(--mono)", letterSpacing: ".04em",
      }}
    >
      <Link href="/" aria-label="SciCollab home" style={{ display: "inline-flex", alignItems: "flex-end", color: "#F2F0EC" }}>
        <span style={{ position: "relative", font: "700 13px/1 var(--mono)", letterSpacing: "-.03em" }}>
          scicollab
          <span style={{ position: "absolute", left: 0, bottom: -4, width: 9, height: 2, background: "#FF5A14" }} />
        </span>
        <span style={{ font: "700 13px/1 var(--mono)", color: "#FF5A14" }}>/</span>
      </Link>
      <span>© {new Date().getFullYear()} SciCollab</span>

      <nav aria-label="Site" style={{ display: "flex", flexWrap: "wrap", gap: "8px 20px", marginLeft: "auto" }}>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} style={{ color: "#F2F0EC" }}>{l.label}</Link>
        ))}
      </nav>

      <div style={{ display: "flex", gap: 8 }}>
        <a href={SOCIAL.facebook} aria-label="SciCollab on Facebook (coming soon)" title="Facebook — coming soon" style={icon}>
          <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M13.5 21v-7.6h2.6l.4-3h-3V8.5c0-.9.3-1.5 1.5-1.5h1.6V4.3c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.8v3h2.6V21h3.1z" />
          </svg>
        </a>
        <a href={SOCIAL.linkedin} aria-label="SciCollab on LinkedIn (coming soon)" title="LinkedIn — coming soon" style={icon}>
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="currentColor" d="M6.9 8.6H3.8V20h3.1V8.6zM5.4 3.5a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM20.2 13.5c0-3.1-1.7-4.6-3.9-4.6-1.8 0-2.6 1-3.1 1.7V8.6h-3V20h3.1v-6.2c0-.4 0-.7.1-1 .3-.7.9-1.4 2-1.4 1.4 0 2 1.1 2 2.6v6h3.1v-6.5z" />
          </svg>
        </a>
      </div>
    </footer>
  );
}

const icon: React.CSSProperties = {
  width: 30, height: 30, display: "inline-flex", alignItems: "center", justifyContent: "center",
  border: "1px solid #2E2C29", color: "#F2F0EC",
};
