import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import PublicPage, { h2, small } from "@/components/PublicPage";

export const metadata: Metadata = { title: "Questions — SciCollab" };

/*
 * Answers built from the team's submitted deck (May 2026): concerned cohort,
 * customer profile (job / pain / gain), market sizing, competitive landscape,
 * value-proposition tests, revenue model, legal plan and timeline.
 * Prices are left out on purpose — the deck lists willingness-to-pay for the
 * institutional tier as still to be tested.
 */

type QA = { q: string; a: ReactNode };
type Group = { title: string; items: QA[] };

const GROUPS: Group[] = [
  {
    title: "Who it is for",
    items: [
      {
        q: "Who is SciCollab for?",
        a: <>Researchers in the <b>pre-publication</b> phase — PhD candidates and postdocs first: the people at the bench who hit a failed protocol and need credible context fast. Research leaders, R&amp;D directors, universities and small biotech companies are the next circle.</>,
      },
      {
        q: "Which fields?",
        a: <>Experimental, data-heavy sciences first — life and health sciences in particular — where methods, conditions and failed runs matter most. Natural sciences, engineering and agricultural research follow the same pattern and are in scope.</>,
      },
      {
        q: "Which countries?",
        a: <>We start with Europe and North America, home to roughly 3.5 million full-time researchers. Anyone can read and ask; our first communities and pilots are there.</>,
      },
      {
        q: "Who pays for it?",
        a: <>Not individual researchers: they use SciCollab for free. Institutions and R&amp;D organisations pay for <b>private, governed workspaces</b> for their labs — with audit logs, single sign-on and support for open-science compliance. Pricing is not final yet; we are setting it with our first pilot institutions.</>,
      },
    ],
  },
  {
    title: "The problem",
    items: [
      {
        q: "What problem does SciCollab solve?",
        a: <>When an experiment deviates from the protocol, today&rsquo;s path is a chain of dead ends: ask a peer (nobody knows), ask the supervisor (stumped or busy), e-mail collaborators (no answer) — and the work disappears. SciCollab shortens the <b>time to a first useful answer</b> and keeps what was learned, including what did not work.</>,
      },
      {
        q: "Isn't AI enough?",
        a: <>Every researcher in our second survey asks AI first when an experiment fails — and their success rates ranged from 5% to 90%. AI has no access to the &ldquo;dirty&rdquo; context: the exact conditions, the failed runs, the unpublished data. SciCollab uses AI to <b>find and structure</b> prior cases; people with hands-on experience validate them.</>,
      },
      {
        q: "Why put negative results first?",
        a: <>Because a failure that nobody records gets repeated. In our survey, 71% of researchers said they would share negative results, yet none of them follows an existing negative-results platform — a journal is the wrong place for them. On SciCollab, a null result is part of the normal workflow: citable, searchable, and credited on your profile.</>,
      },
    ],
  },
  {
    title: "How it is different",
    items: [
      {
        q: "How is it different from ResearchGate, Stack Overflow or GitHub?",
        a: (
          <>
            Each solves one piece:
            <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              <li><b>ResearchGate</b> — networking and papers, but no data sharing and no troubleshooting.</li>
              <li><b>Stack Overflow</b> — fast answers, but built for code, not for the lab.</li>
              <li><b>GitHub</b> — excellent versioning, but you need to code, and it gives no academic credit.</li>
              <li><b>Electronic lab notebooks</b> — good data management, but the knowledge stays inside one lab.</li>
            </ul>
            <div style={{ marginTop: 8 }}>SciCollab combines peer Q&amp;A, method sharing, negative results and data in one place, made for scientists.</div>
          </>
        ),
      },
      {
        q: "What is a method card?",
        a: <>A structured, versioned record of how something was actually done — materials, conditions, outcome — including the conditions under which it failed. Others can reuse (&ldquo;fork&rdquo;) it, and their results attach to it, whether they worked or not.</>,
      },
      {
        q: "What do I get for helping others?",
        a: <>Reputation that reflects real contribution — answers, methods, reviews, negative results — kept as separate measures rather than one score. Credit for co-authorship is agreed with the project owner; see the <Link href="/terms#clause-3.4">Terms</Link>.</>,
      },
    ],
  },
  {
    title: "Joining",
    items: [
      {
        q: "Is it free?",
        a: <>Yes, for individual researchers. Paid plans are for institutions that want private workspaces for their teams.</>,
      },
      {
        q: "When can I join?",
        a: <>We are preparing an invite-only beta with a first cohort of about 50 researchers, before a public launch targeted for December 2026. To be on the list, <Link href="/contact">write to us</Link>.</>,
      },
      {
        q: "Can my lab or institution run a pilot?",
        a: <>Yes. A pilot usually starts with one to three labs and a local champion, then widens. <Link href="/contact?topic=pilot">Tell us about your lab</Link>.</>,
      },
    ],
  },
  {
    title: "Your data and your rights",
    items: [
      {
        q: "Who owns what I post?",
        a: <>What is in your own workspace stays yours. What you add to someone else&rsquo;s thread or project is free to reuse (CC0) unless you agree credit with them first. Details in the <Link href="/terms">Terms &amp; Conditions</Link> (draft).</>,
      },
      {
        q: "Can I post something I might patent?",
        a: <>Not in a public area. Under the European Patent Convention, publishing an invention can destroy its novelty — there is no general grace period. Keep that work in a private workspace. See <Link href="/terms#clause-2.1">clause 2.1</Link>.</>,
      },
      {
        q: "Where will my data be stored?",
        a: <>Our target is cloud infrastructure in the European Union, for data sovereignty and GDPR compliance. The preview you can see today runs on example data only — no real research data is stored in it.</>,
      },
    ],
  },
];

export default function QuestionsPage() {
  return (
    <PublicPage
      eyebrow="QUESTIONS"
      title="Questions people ask us"
      lede="Who SciCollab is for, what it solves, and how it works. Can't find yours? Ask us directly."
    >
      {GROUPS.map((g, gi) => (
        <section key={g.title}>
          <h2 style={gi ? h2 : { ...h2, marginTop: 0, paddingTop: 0, borderTop: 0 }}>{g.title}</h2>
          <div className="sc-soft" style={{ border: "1px solid var(--rule)" }}>
            {g.items.map((item, i) => (
              <details key={item.q} style={{ borderTop: i ? "1px solid var(--rule)" : 0 }}>
                <summary style={{ cursor: "pointer", padding: "13px 14px", font: "600 13.5px/1.4 var(--mono)", listStylePosition: "inside" }}>
                  {item.q}
                </summary>
                <div style={{ padding: "0 14px 14px 30px", font: "400 14.5px/1.65 var(--sans)", maxWidth: "70ch" }}>{item.a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <p style={{ font: "400 14.5px/1.6 var(--sans)", marginTop: 30 }}>
        Another question? <Link href="/contact">Write to us</Link> — a person from the team answers.
      </p>
      <p style={{ ...small, marginTop: 16 }}>
        Figures come from our own 2026 field research (surveys of 17 and 6 researchers) and market sizing; they are
        small samples and are stated as such.
      </p>
    </PublicPage>
  );
}
