import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Research record — the wired version of board B3 screens 16 (personal
 * dashboard) and 18 (change log).
 *
 * Every number here is a count of rows the researcher can open. Nothing is
 * weighted, nothing is summed across axes, nothing is compared with other
 * people. If a number moves, the ledger shows the row that moved it.
 */

export type Axis =
  | "methods" | "nulls" | "replications"
  | "answers" | "questions" | "reviews"
  | "mentoring" | "reuse" | "data";

export const AXES: { key: Axis; label: string; unit: string }[] = [
  { key: "methods",      label: "Methods recorded", unit: "cards" },
  { key: "nulls",        label: "Null results",     unit: "cards" },
  { key: "replications", label: "Replications run", unit: "runs" },
  { key: "answers",      label: "Answers given",    unit: "answers" },
  { key: "questions",    label: "Questions asked",  unit: "questions" },
  { key: "reviews",      label: "Reviews written",  unit: "reviews" },
  { key: "mentoring",    label: "People mentored",  unit: "people" },
  { key: "reuse",        label: "Reuse by others",  unit: "events" },
  { key: "data",         label: "Data deposited",   unit: "datasets" },
];

export type Event = {
  at: string;
  axis: Axis;
  text: string;
  href: string;
  /** True when someone else did something with your work. */
  reuse: boolean;
};

export type Loop = { text: string; href: string; hint: string };

export type AxisSummary = {
  key: Axis; label: string; unit: string;
  total: number;
  recent: number;              // inside the chosen window
  weekly: number[];            // oldest → newest, last bucket is the current week
  facts: [string, string][];   // secondary lines under the number
};

/** One shared card and what others did with it. Reads are added by the page. */
export type Output = {
  id: string; code: string; title: string; outcome: string | null; visibility: string;
  forks: number; carried: number; held: number; failed: number; reviews: number;
};

export type Record_ = {
  weeks: number;
  weekStarts: Date[];
  axes: AxisSummary[];
  events: Event[];
  reuse: Event[];
  loops: Loop[];
  outputs: Output[];
  privateCards: number;
};

type Client = SupabaseClient<any, "public", any>;

const DAY = 864e5;

/** Monday 00:00 of the week containing d, in server-local time. */
export function weekStart(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

const list = <T,>(v: T[] | null | undefined) => v ?? [];
const uniq = <T,>(v: T[]) => [...new Set(v)];

export async function loadRecord(supabase: Client, me: string, weeks: number): Promise<Record_> {
  const [
    { data: myCards }, { data: myQuestions }, { data: myAnswers }, { data: myData }, { data: profile },
    { data: myRepros }, { data: myReviews }, { data: mentees },
  ] = await Promise.all([
    supabase.from("method_cards").select("id, code, title, outcome, visibility, tags, created_at").eq("author_id", me),
    supabase.from("questions").select("id, title, created_at").eq("author_id", me),
    supabase.from("answers").select("id, question_id, accepted, created_at").eq("author_id", me),
    supabase.from("datasets").select("id, title, created_at").eq("owner_id", me),
    supabase.from("profiles").select("techniques").eq("id", me).maybeSingle(),
    supabase.from("reproductions").select("id, card_id, outcome, created_at").eq("user_id", me),
    supabase.from("reviews").select("id, card_id, verdict, created_at").eq("reviewer_id", me),
    supabase.from("mentorships").select("id, mentee_id, note, created_at").eq("mentor_id", me),
  ]);

  const cards = list(myCards), questions = list(myQuestions), answers = list(myAnswers), datasets = list(myData);
  const cardIds = cards.map((c) => c.id);
  const qIds = questions.map((q) => q.id);
  const answeredQIds = uniq(answers.map((a) => a.question_id));
  const othersCardIds = uniq([...list(myRepros), ...list(myReviews)].map((r) => r.card_id));

  // PostgREST rejects an empty in(), so every dependent query is guarded.
  const none = Promise.resolve({ data: [] as any[] });
  const [
    { data: forks }, { data: carried }, { data: answeredQs }, { data: answersOnMine }, { data: openQs },
    { data: reprosOnMine }, { data: reviewsOnMine }, { data: theirCards },
  ] = await Promise.all([
    cardIds.length ? supabase.from("method_cards").select("id, code, title, author_id, forked_from, created_at").in("forked_from", cardIds).neq("author_id", me) : none,
    cardIds.length ? supabase.from("questions").select("id, title, author_id, method_card_id, created_at").in("method_card_id", cardIds).neq("author_id", me) : none,
    answeredQIds.length ? supabase.from("questions").select("id, title").in("id", answeredQIds) : none,
    qIds.length ? supabase.from("answers").select("question_id, accepted").in("question_id", qIds) : none,
    supabase.from("questions").select("id, title, tags, author_id, created_at").neq("author_id", me).order("created_at", { ascending: false }).limit(50),
    cardIds.length ? supabase.from("reproductions").select("id, card_id, user_id, outcome, created_at").in("card_id", cardIds).neq("user_id", me) : none,
    cardIds.length ? supabase.from("reviews").select("card_id").in("card_id", cardIds) : none,
    othersCardIds.length ? supabase.from("method_cards").select("id, code, title").in("id", othersCardIds) : none,
  ]);

  const others = uniq([
    ...list(forks).map((r) => r.author_id), ...list(carried).map((r) => r.author_id), ...list(openQs).map((r) => r.author_id),
    ...list(reprosOnMine).map((r) => r.user_id), ...list(mentees).map((m) => m.mentee_id),
  ]);
  const { data: people } = others.length
    ? await supabase.from("profiles").select("id, display_name").in("id", others)
    : { data: [] as any[] };
  const who = (id: string) => list(people).find((p) => p.id === id)?.display_name ?? "Someone";
  const codeOf = (id: string) => cards.find((c) => c.id === id)?.code ?? "your card";
  const theirs = (id: string) => list(theirCards).find((c) => c.id === id);
  const qTitle = (id: string) => list(answeredQs).find((q) => q.id === id)?.title ?? "a question";

  // ── the ledger ───────────────────────────────────────────────────────────
  const events: Event[] = [
    ...cards.map((c): Event => ({
      at: c.created_at,
      axis: c.outcome === "negative" ? "nulls" : "methods",
      text: c.outcome === "negative" ? `Recorded a null result · ${c.code} ${c.title}` : `Recorded ${c.code} ${c.title}`,
      href: `/methods/${c.id}`, reuse: false,
    })),
    ...list(myRepros).map((r): Event => {
      const c = theirs(r.card_id);
      return {
        at: r.created_at, axis: "replications",
        text: `Ran ${c ? `${c.code} ${c.title}` : "a card"}, ${r.outcome === "held" ? "it held" : "it failed"}`,
        href: `/methods/${r.card_id}`, reuse: false,
      };
    }),
    ...questions.map((q): Event => ({ at: q.created_at, axis: "questions", text: `Asked “${q.title}”`, href: `/questions/${q.id}`, reuse: false })),
    ...answers.map((a): Event => ({
      at: a.created_at, axis: "answers",
      text: `${a.accepted ? "Answered, accepted" : "Answered"} · “${qTitle(a.question_id)}”`,
      href: `/questions/${a.question_id}`, reuse: false,
    })),
    ...list(myReviews).map((r): Event => {
      const c = theirs(r.card_id);
      return { at: r.created_at, axis: "reviews", text: `Reviewed ${c ? `${c.code} ${c.title}` : "a card"}`, href: `/methods/${r.card_id}`, reuse: false };
    }),
    ...list(mentees).map((m): Event => ({
      at: m.created_at, axis: "mentoring",
      text: `${who(m.mentee_id)} named you as a guide${m.note ? ` · “${m.note}”` : ""}`,
      href: "/network", reuse: false,
    })),
    ...list(forks).map((f): Event => ({
      at: f.created_at, axis: "reuse",
      text: `${who(f.author_id)} forked ${codeOf(f.forked_from)} → ${f.code ?? ""} ${f.title}`.replace(/\s+/g, " "),
      href: `/methods/${f.id}`, reuse: true,
    })),
    ...list(carried).map((q): Event => ({
      at: q.created_at, axis: "reuse",
      text: `${who(q.author_id)} asked a question carrying ${codeOf(q.method_card_id)}`,
      href: `/questions/${q.id}`, reuse: true,
    })),
    ...list(reprosOnMine).map((r): Event => ({
      at: r.created_at, axis: "reuse",
      text: `${who(r.user_id)} reproduced ${codeOf(r.card_id)}, ${r.outcome === "held" ? "it held" : "it failed"}`,
      href: `/methods/${r.card_id}`, reuse: true,
    })),
    ...datasets.map((d): Event => ({ at: d.created_at, axis: "data", text: `Deposited ${d.title}`, href: "/data", reuse: false })),
  ].sort((a, b) => +new Date(b.at) - +new Date(a.at));

  // ── weekly buckets ───────────────────────────────────────────────────────
  const now = new Date();
  const first = new Date(weekStart(now).getTime() - (weeks - 1) * 7 * DAY);
  const weekStarts = Array.from({ length: weeks }, (_, i) => new Date(first.getTime() + i * 7 * DAY));
  const bucket = (iso: string) => {
    const i = Math.round((weekStart(new Date(iso)).getTime() - first.getTime()) / (7 * DAY));
    return i >= 0 && i < weeks ? i : -1;
  };

  const accepted = answers.filter((a) => a.accepted).length;
  const methodCards = cards.filter((c) => c.outcome !== "negative");
  const shared = methodCards.filter((c) => c.visibility !== "private").length;
  const acceptedQ = new Set(list(answersOnMine).filter((a) => a.accepted).map((a) => a.question_id));
  const ofN = (n: number, d: number) => (d ? `${n} of ${d}` : "—");
  const heldBy = (rows: any[]) => rows.filter((r) => r.outcome === "held").length;

  const facts: Record<Axis, [string, string][]> = {
    methods:      [["shared beyond you", ofN(shared, methodCards.length)], ["no outcome yet", String(methodCards.filter((c) => !c.outcome).length)]],
    nulls:        [["counted", "in full, like any result"], ["of your cards", cards.length ? `${Math.round(((cards.length - methodCards.length) / cards.length) * 100)}%` : "—"]],
    replications: [["held", ofN(heldBy(list(myRepros)), list(myRepros).length)], ["failed, recorded anyway", String(list(myRepros).length - heldBy(list(myRepros)))]],
    answers:      [["accepted", ofN(accepted, answers.length)], ["questions helped", String(answeredQIds.length)]],
    questions:    [["with an accepted answer", ofN(acceptedQ.size, questions.length)], ["still open", String(questions.length - acceptedQ.size)]],
    reviews:      [["cards reviewed", String(uniq(list(myReviews).map((r) => r.card_id)).length)], ["said clear to run", String(list(myReviews).filter((r) => r.verdict === "clear").length)]],
    mentoring:    [["named by them, not you", String(list(mentees).length)], ["visible to", "the two of you"]],
    reuse:        [["forks · questions carrying", `${list(forks).length} · ${list(carried).length}`], ["reproductions held", ofN(heldBy(list(reprosOnMine)), list(reprosOnMine).length)]],
    data:         [["deposit flow", "designed, not wired"], ["see", "board E1"]],
  };

  const axes: AxisSummary[] = AXES.map((a) => {
    const mine = events.filter((e) => e.axis === a.key);
    const weekly = Array(weeks).fill(0);
    for (const e of mine) { const i = bucket(e.at); if (i >= 0) weekly[i]++; }
    return { ...a, total: mine.length, recent: weekly.reduce((s, n) => s + n, 0), weekly, facts: facts[a.key] };
  });

  // ── per-output reuse (reads are added by the page, from aggregates) ─────
  const outputs: Output[] = cards
    .filter((c) => c.visibility !== "private")
    .map((c) => {
      const r = list(reprosOnMine).filter((x) => x.card_id === c.id);
      return {
        id: c.id, code: c.code, title: c.title, outcome: c.outcome, visibility: c.visibility,
        forks: list(forks).filter((f) => f.forked_from === c.id).length,
        carried: list(carried).filter((q) => q.method_card_id === c.id).length,
        held: heldBy(r), failed: r.length - heldBy(r),
        reviews: list(reviewsOnMine).filter((v) => v.card_id === c.id).length,
      };
    });

  // ── open loops: what you could do next, never a nag ─────────────────────
  const answeredByAnyone = new Set(list(answersOnMine).map((a) => a.question_id));
  const mineTags = new Set([...(profile?.techniques ?? []), ...cards.flatMap((c) => c.tags ?? [])].map((t: string) => t.toLowerCase()));
  const candidates = list(openQs).filter((q) => (q.tags ?? []).some((t: string) => mineTags.has(t.toLowerCase())) && !answeredQIds.includes(q.id));
  const { data: candAnswers } = candidates.length
    ? await supabase.from("answers").select("question_id").in("question_id", candidates.map((q) => q.id))
    : { data: [] as any[] };
  const answeredCand = new Set(list(candAnswers).map((a) => a.question_id));

  const loops: Loop[] = [
    ...cards.filter((c) => !c.outcome).map((c) => ({ text: `${c.code} has no outcome yet`, href: `/methods/${c.id}`, hint: "record it, a null counts" })),
    ...questions.filter((q) => !acceptedQ.has(q.id)).map((q) => ({
      text: `“${q.title}”`, href: `/questions/${q.id}`,
      hint: answeredByAnyone.has(q.id) ? "has answers, none accepted" : "no answers yet",
    })),
    ...candidates.filter((q) => !answeredCand.has(q.id)).slice(0, 3).map((q) => ({
      text: `${who(q.author_id)} · “${q.title}”`, href: `/questions/${q.id}`, hint: "unanswered, in your techniques",
    })),
  ];

  return {
    weeks, weekStarts, axes, events,
    reuse: events.filter((e) => e.reuse),
    loops, outputs,
    privateCards: cards.filter((c) => c.visibility === "private").length,
  };
}

export const AXIS_LABEL = Object.fromEntries(AXES.map((a) => [a.key, a.label])) as Record<Axis, string>;
