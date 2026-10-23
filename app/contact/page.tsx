import type { Metadata } from "next";
import PublicPage, { small } from "@/components/PublicPage";
import ContactForm from "@/components/ContactForm";

export const metadata: Metadata = { title: "Contact — SciCollab" };

/** ?topic=pilot (the landing page's "Talk to us about a pilot") preselects the topic. */
const SHORTCUTS: Record<string, string> = {
  pilot: "A pilot for my lab or institution",
  press: "Press",
};

export default async function ContactPage({ searchParams }: { searchParams: Promise<{ topic?: string }> }) {
  const { topic } = await searchParams;
  return (
    <PublicPage
      eyebrow="CONTACT"
      title="Talk to us"
      lede="A question, a pilot for your lab, an article — write to us. A person from the team reads every message and answers by e-mail."
    >
      <ContactForm initialTopic={topic ? SHORTCUTS[topic] : undefined} />
      <p style={{ ...small, marginTop: 28 }}>
        The anti-robot check runs in your browser for about a second. It uses no cookies and sends nothing to a third party.
      </p>
    </PublicPage>
  );
}
