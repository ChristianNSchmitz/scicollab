import Link from "next/link";
import { expressInterest } from "@/app/actions/calls";
import { btn, btnPrimary, field } from "@/components/ui";

/** What the viewer has with a call: their own answer, and how many answered if it is theirs. */
export type CallInfo = {
  /** The viewer's own answer to this call, if they gave one. */
  my: { shortlisted: boolean } | null;
  /** Answers from other people; only the caller can see these. */
  answers: number;
  /** Where "I'm interested" returns to: the feed, with its filters (see lib/calls.ts safeBack). */
  back: string;
};

/**
 * The ways to respond to a call for collaborators, in one place so the feed
 * card and the Calls tab never differ: the caller sees how many are interested,
 * someone who answered sees that, and anyone else can answer with a short pitch
 * while the call is open.
 */
export default function CallActions({ postId, authorId, authorName, me, status, info }: {
  postId: string; authorId: string; authorName?: string | null; me: string; status: string | null; info: CallInfo;
}) {
  const open = (status ?? "open") === "open";
  const first = authorName?.split(" ")[0] ?? "the caller";

  if (authorId === me) {
    return <Link href={`/posts/${postId}#call`} style={{ ...btn, height: 32 }}>{info.answers} interested · shortlist and status</Link>;
  }
  if (info.my) {
    return (
      <span style={{ font: "500 13px/1.5 var(--sans)", color: "var(--ok)" }}>
        ✓ You said you are interested{info.my.shortlisted ? ", and you are on the shortlist" : ""}.{" "}
        <Link href={`/posts/${postId}#call`} style={{ color: "var(--link)" }}>See or withdraw</Link>
      </span>
    );
  }
  if (!open) return <span style={{ font: "400 13px/1.5 var(--sans)", color: "var(--mute)" }}>This call is {status}.</span>;
  return (
    <details style={{ flex: 1 }}>
      <summary style={{ ...btnPrimary, height: 32, borderRadius: 999, display: "inline-flex", alignItems: "center", listStyle: "none", cursor: "pointer" }}>I&apos;m interested</summary>
      <form action={expressInterest.bind(null, postId)} style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10, maxWidth: 560 }}>
        <input type="hidden" name="back" value={info.back} />
        <label htmlFor={`pitch-${postId}`} style={{ font: "600 12px/1.4 var(--sans)", color: "var(--mute)" }}>Your pitch: what you can do, with which system, and when</label>
        <textarea id={`pitch-${postId}`} name="pitch" rows={3} maxLength={1000} required style={field} />
        <div><button type="submit" style={btnPrimary}>Send to {first}</button></div>
      </form>
    </details>
  );
}
