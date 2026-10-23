import type { Metadata } from "next";
import Link from "next/link";
import PublicPage, { h2, p, small } from "@/components/PublicPage";

export const metadata: Metadata = { title: "Terms & Conditions — SciCollab" };

/*
 * Source: the "Contributions, Authorship & Patents" section the team drafted
 * in July 2026 (two-track framework: patents disclaimed with a disclosure
 * warning; External Contributions default to CC0 unless credit is agreed).
 *
 * Still open before this can be published as binding — to settle with an EU
 * IP / technology lawyer: CC0 vs CC-BY · strength of 3.5 · governing law and
 * courts · consumer vs B2B framing (Directive 93/13/EEC) · a separate clause
 * asserting the platform's database right in the aggregated corpus.
 * The page says it is a draft until then.
 */

type Clause = { n: string; title: string; text: string };
type Section = { n: string; title: string; intro?: string; clauses: Clause[] };

const DEFINITIONS: [string, string][] = [
  ["Platform", "the SciCollab service."],
  ["Member", "any registered user."],
  ["Workspace (“your Drive”)", "a Member’s own project space and associated data on the Platform."],
  ["Project Owner", "the Member who owns the Workspace, thread, question or data to which a Contribution relates. For a public forum question, the Project Owner is the Member who started the thread."],
  ["Contribution", "any content a Member submits (answer, comment, suggestion, method, code, data, etc.)."],
  ["Own Contribution", "a Contribution made inside the contributing Member’s own Workspace."],
  ["External Contribution", "a Contribution made to another Member’s Workspace, thread or question, or to a public forum — i.e. anything not in the contributing Member’s own Drive."],
];

const SECTIONS: Section[] = [
  {
    n: "2", title: "Patents & inventorship",
    intro: "We warn you; you manage it together.",
    clauses: [
      { n: "2.1", title: "Disclosure warning", text: "Public discussion can destroy the patentability of an invention. Under the European Patent Convention there is no general grace period: material posted in any public area of the Platform may become prior art and prevent a valid patent — for you and for everyone. Do not post material you intend to patent, or that relates to a pending or contemplated patent, in public areas. Keep confidential or potentially patentable work in a private Workspace." },
      { n: "2.2", title: "No determination by the Platform", text: "Inventorship is a matter of law, determined by the actual inventive contribution and by the competent authorities and courts — not by these Terms and not by the Platform. The Platform does not decide, allocate, or verify inventorship or patent entitlement, and takes no position in any dispute between Members." },
      { n: "2.3", title: "Members manage it between themselves", text: "Any question of inventorship, co-inventorship or patent ownership arising from an interaction on the Platform is to be discussed and agreed directly between the Members concerned. Members who anticipate patentable output are strongly advised to agree in writing, before any substantive disclosure, how inventorship and ownership will be handled, and to carry out that work in a private Workspace under appropriate confidentiality." },
      { n: "2.4", title: "No waiver of statutory rights", text: "Nothing in these Terms waives, transfers or diminishes any inventor’s statutory right to be named, any right to compensation, or any right of a Member’s employer or institution under applicable employee-invention law. A Member cannot grant more than they lawfully hold." },
      { n: "2.5", title: "Platform records", text: "The Platform keeps time-stamped records of Contributions and may disclose them only where required by law or valid legal process, under its Privacy & Data Retention Policy." },
    ],
  },
  {
    n: "3", title: "Authorship, citation & copyright in contributions",
    clauses: [
      { n: "3.1", title: "Your own Workspace", text: "A Member retains all rights they lawfully hold in their Own Contributions, subject only to the licence granted to the Platform to host, display, back up and operate the service." },
      { n: "3.2", title: "Default for External Contributions — CC0", text: "To the fullest extent permitted by applicable law, each Member irrevocably dedicates to the public domain, under the Creative Commons CC0 1.0 Universal dedication, all copyright and sui generis database rights they may hold in their External Contributions; where such dedication is not permitted, the Member grants the widest possible royalty-free, irrevocable licence to the same effect. For the avoidance of doubt, this concerns copyright and related rights only and does not license or affect patent rights or inventorship (see section 2)." },
      { n: "3.3", title: "No automatic authorship or citation", text: "An External Contribution does not, by itself, entitle the contributing Member to be named as an author of, or cited in, any publication produced by the Project Owner or other Members. Co-authorship or citation arises only where agreed directly with the Project Owner." },
      { n: "3.4", title: "Opt-in for credit", text: "A Member who wishes to be credited (as author, contributor or cited source) should request this from the Project Owner, in the relevant thread and before contributing, and obtain the Project Owner’s agreement. Credit is then governed by that agreement, not by these Terms." },
      { n: "3.5", title: "Ask before building on another Member’s work", text: "A Member shall not publish, submit for publication, or otherwise externally disseminate any work substantially derived from another Member’s Workspace or data without first requesting, and obtaining the agreement of, that Project Owner." },
      { n: "3.6", title: "Moral rights & academic integrity unaffected", text: "Where moral rights (including the right of attribution) cannot be waived under applicable law, they remain with the author. Nothing in this section overrides the authorship, attribution or research-integrity rules of any journal, funder, employer, or applicable misconduct framework (e.g. ICMJE / CRediT). Using another’s substantial intellectual contribution without proper attribution may constitute misconduct regardless of these Terms." },
    ],
  },
  {
    n: "4", title: "Warranties, role & liability",
    clauses: [
      { n: "4.1", title: "Member warranties", text: "Each Member warrants that they are entitled to make their Contributions and to grant the rights and dedications above, and that doing so breaches no employer, institutional, funding or third-party obligation. Each Member remains solely responsible for compliance with their own institution’s IP policy and applicable employee-invention law." },
      { n: "4.2", title: "Neutral host", text: "The Platform provides collaboration tools only. It is a neutral hosting service, exercises no editorial control over Contributions, and provides no legal, patent or IP advice." },
      { n: "4.3", title: "Disputes between Members", text: "Any dispute concerning authorship, citation, inventorship, ownership or use of Contributions is solely between the Members concerned. To the fullest extent permitted by law, the Platform is not liable for such disputes or their outcome." },
      { n: "4.4", title: "Governing law", text: "[To be confirmed. French law is proposed, with the competent courts to be specified.]" },
    ],
  },
];

export default function TermsPage() {
  return (
    <PublicPage
      eyebrow="TERMS & CONDITIONS"
      title="Terms & Conditions"
      lede="How contributions, credit and patents work on SciCollab. In short: what is in your own Workspace stays yours; what you add to someone else's work is free to use unless you agree credit first; and nothing patentable belongs in a public thread."
    >
      <div role="note" style={{ border: "1px solid var(--flag)", background: "var(--bg)", padding: "12px 14px", marginBottom: 8 }}>
        <div style={{ font: "700 11px/1 var(--mono)", letterSpacing: ".1em", color: "var(--flag-ink)", marginBottom: 6 }}>DRAFT — NOT YET IN FORCE</div>
        <p style={{ ...p, margin: 0, font: "400 13px/1.6 var(--sans)" }}>
          This is the working draft of the section on contributions, authorship and patents. It is being reviewed
          with an EU intellectual-property lawyer and will be completed with the account, privacy and acceptable-use
          sections before public launch. Questions about it are welcome through the <Link href="/contact">contact form</Link>.
        </p>
      </div>

      <h2 style={h2}>1. Definitions</h2>
      <dl style={{ margin: 0 }}>
        {DEFINITIONS.map(([term, def]) => (
          <div key={term} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 200px) 1fr", gap: "4px 16px", padding: "8px 0", borderBottom: "1px solid var(--rule)" }}>
            <dt style={{ font: "600 12.5px/1.5 var(--mono)" }}>{term}</dt>
            <dd style={{ margin: 0, font: "400 14px/1.6 var(--sans)" }}>{def}</dd>
          </div>
        ))}
      </dl>

      {SECTIONS.map((s) => (
        <section key={s.n}>
          <h2 style={h2}>{s.n}. {s.title}</h2>
          {s.intro && <p style={{ ...p, fontStyle: "italic", color: "var(--mute)" }}>{s.intro}</p>}
          {s.clauses.map((c) => (
            <p key={c.n} id={`clause-${c.n}`} style={p}>
              <strong style={{ font: "600 13px/1.6 var(--mono)" }}>{c.n} {c.title}.</strong> {c.text}
            </p>
          ))}
        </section>
      ))}

      <p style={{ ...small, marginTop: 32, paddingTop: 14, borderTop: "1px solid var(--rule)" }}>
        Draft v0.1 · October 2026 · References: European Patent Convention Art. 54–55, 60; CC0 1.0 Universal;
        Regulation (EU) 2022/2065 (Digital Services Act) Art. 6 &amp; 8; Directive 96/9/EC (database right);
        Directive 93/13/EEC (unfair terms).
      </p>
    </PublicPage>
  );
}
