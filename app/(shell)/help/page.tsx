import Link from "next/link";
import { Page, Panel, PanelHead, mono } from "@/components/ui";

/**
 * Help: how to get going, and where to go when something is unclear. A full
 * help centre with a support channel (R10 in the coverage audit) does not
 * exist yet; until it does, questions go through the contact form.
 */
const START = [
  { href: "/groups#topics", label: "Join topic groups", text: "Every post is filed in a topic group. Join the ones for your techniques, and their posts appear in your feed." },
  { href: "/settings#orcid", label: "Link your ORCID", text: "Your publications, citations and h-index are then kept up to date for you." },
  { href: "/methods/new", label: "Record a method", text: "A method card is the core of SciCollab: what you did and what came out, including null results." },
  { href: "/ask", label: "Ask or answer", text: "Questions stay public and findable, so the next person with the same problem finds the answer." },
  { href: "/network", label: "Follow people", text: "Your co-authors who are here are suggested first. Their posts, papers and answers then appear under Following on Home." },
  { href: "/groups", label: "Join or start a group", text: "A group is your lab, consortium or journal club: its members, shared projects and what they did lately." },
  { href: "/settings#privacy", label: "Choose who sees your profile", text: "Members always can; visitors only if you make it public. Type @ and a name to bring someone into a post or answer." },
];

const MORE = [
  { href: "/faq", label: "Frequently asked questions" },
  { href: "/about", label: "About SciCollab" },
  { href: "/terms", label: "Terms & conditions" },
  { href: "/settings#password", label: "Change your password" },
  { href: "/settings#account", label: "Download or delete your data" },
  { href: "/contact", label: "Contact the team" },
];

export default function Help() {
  return (
    <Page title="Help" lede="How to get started, and where to look when something is unclear. Press ⌘K (Ctrl K on Windows) anywhere to search.">
      <div className="sc-pair" style={{ gap: 14, alignItems: "start" }}>
        <Panel>
          <PanelHead>Getting started</PanelHead>
          {START.map((s, i) => (
            <Link key={s.href} href={s.href} style={{ display: "flex", gap: 12, padding: "11px 14px", borderBottom: "1px solid var(--rule)", textDecoration: "none", color: "var(--ink)" }}>
              <span style={{ font: mono(12, 700), color: "var(--signal-ink)" }}>{i + 1}</span>
              <span>
                <span style={{ font: mono(12.5, 700) }}>{s.label}</span>
                <span style={{ display: "block", font: "400 13px/1.55 var(--sans)", color: "var(--mute)", marginTop: 2 }}>{s.text}</span>
              </span>
            </Link>
          ))}
        </Panel>
        <Panel>
          <PanelHead>More help</PanelHead>
          {MORE.map((m) => (
            <Link key={m.href} href={m.href} style={{ display: "flex", gap: 8, padding: "10px 14px", borderBottom: "1px solid var(--rule)", font: "400 13.5px/1.5 var(--sans)", color: "var(--ink)", textDecoration: "none" }}>
              <span style={{ color: "var(--signal-ink)" }}>→</span>{m.label}
            </Link>
          ))}
          <p style={{ margin: 0, padding: "10px 14px", font: "400 13px/1.6 var(--sans)", color: "var(--mute)" }}>
            Something broken or missing? Tell us through the contact form. To flag a post, answer, message or person to the moderation team, use &ldquo;Report&rdquo; next to it.
          </p>
        </Panel>
      </div>
    </Page>
  );
}
