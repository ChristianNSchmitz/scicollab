import { isConfigured } from "@/lib/mode";
import { tables, ME } from "@/lib/demo/store";

/**
 * A little more history for the demo store, so the record has weeks to show
 * and someone else's reuse to point at. Demo mode only, in memory only, and
 * idempotent: it checks for its own rows rather than a flag, so a hot reload
 * of the store module cannot double it.
 */
const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

/** The record's own tables, registered with the demo store on first use. */
export function ensureRecordTables() {
  if (isConfigured()) return;
  for (const t of ["reproductions", "reviews", "mentorships", "card_reads"]) {
    if (!tables[t]) tables[t] = [];
  }
}

export function ensureRecordSeed() {
  if (isConfigured()) return;
  ensureRecordTables();
  const cards = tables.method_cards as any[];
  if (cards.some((c) => c.id === "c-0355")) return;

  cards.push(
    {
      id: "c-0355", code: "MC-0355", version: 2, author_id: ME,
      title: "Serum-free medium through incubation — below 5% at every passage",
      method: "As MC-0288, with serum-free Opti-MEM carried through the 48 h incubation.",
      system: "HEK293T · p8–p14", conditions: "37 °C · 5% CO₂ · 48 h",
      outcome: "negative", outcome_detail: "3.1–4.8% across six runs, independent of passage.",
      fails_under: "Serum-free at incubation, at any passage tried.",
      tags: ["transfection", "HEK293T"], visibility: "public",
      forked_from: null, reproductions: 1, created_at: ago(52),
    },
    {
      id: "c-0391", code: "MC-0391", version: 1, author_id: ME,
      title: "qPCR primer validation across two cDNA kits",
      method: "Standard curve over five 4-fold dilutions, both kits, same RNA.",
      system: "HEK293T total RNA", conditions: "60 °C anneal · 40 cycles",
      outcome: "success", outcome_detail: "Efficiency 94–102% for 11 of 12 pairs on both kits.",
      fails_under: "GAPDH pair drops to 81% on kit B. Not used for normalisation since.",
      tags: ["qPCR"], visibility: "lab",
      forked_from: null, reproductions: 0, created_at: ago(31),
    },
    {
      id: "c-0670", code: "MC-0670", version: 1, author_id: "u-okafor",
      title: "Passage cliff — independent repeat, Okafor group",
      method: "MC-0412 run at p12, p16, p20 with our own reagent lot.",
      system: "HEK293T · p12–p20", conditions: "37 °C · 5% CO₂ · 48 h",
      outcome: "negative", outcome_detail: "Cliff between p16 and p20, matching MC-0412.",
      fails_under: "Passage above 18.", tags: ["transfection", "passage number"], visibility: "public",
      forked_from: "c-0412", reproductions: 0, created_at: ago(5),
    },
    {
      id: "c-0688", code: "MC-0688", version: 1, author_id: "u-lindqvist",
      title: "CO₂ drift check — bays 1 and 2",
      method: "MC-0602 repeated on the other two incubators.",
      system: "Incubators · bays 1–2", conditions: "target 5% CO₂",
      outcome: "success", outcome_detail: "Both over-read by 0.3–0.4%.",
      fails_under: "", tags: ["equipment"], visibility: "lab",
      forked_from: "c-0602", reproductions: 0, created_at: ago(1),
    },
  );

  (tables.questions as any[]).push(
    {
      id: "q-2350", author_id: "u-newcomer",
      title: "Is an independent CO₂ meter worth it for a single incubator?",
      body: "Following MC-0602. We only have one incubator, so there is nothing to compare it against.",
      tags: ["equipment", "quality control"], method_card_id: "c-0602", created_at: ago(4),
    },
    {
      id: "q-2361", author_id: "u-lindqvist",
      title: "qPCR efficiency above 105% — inhibition or pipetting?",
      body: "Two of our primer pairs read 108% on the standard curve.",
      tags: ["qPCR"], method_card_id: null, created_at: ago(2),
    },
  );

  (tables.answers as any[]).push(
    {
      id: "a-r1", question_id: "q-2304", author_id: ME,
      body: "We went to 10% methanol and lost about a third of the signal below 30 kDa. Recorded on MC-0517's thread.",
      accepted: true, created_at: ago(2),
    },
    {
      id: "a-r2", question_id: "q-2350", author_id: ME,
      body: "Yes — the incubator's own sensor drifts with it. A meter is cheaper than one lost week.",
      accepted: false, created_at: ago(3),
    },
    {
      id: "a-r3", question_id: "q-2291", author_id: ME,
      body: "Logged CO₂ for 72 h: bay 3 under-reads by 0.6%, which does not explain a cliff on its own.",
      accepted: false, created_at: ago(8),
    },
  );

  (tables.reproductions as any[]).push(
    { id: "r-1", card_id: "c-0412", user_id: "u-okafor",    outcome: "held",   note: "Cliff between p16 and p20 in our hands too.", created_at: ago(5) },
    { id: "r-2", card_id: "c-0602", user_id: "u-lindqvist", outcome: "held",   note: "Same method on bays 1 and 2.",                   created_at: ago(1) },
    { id: "r-3", card_id: "c-0355", user_id: "u-bhatt",     outcome: "failed", note: "Got 9% serum-free at p6, so not every passage.", created_at: ago(17) },
    { id: "r-4", card_id: "c-0288", user_id: ME,            outcome: "held",   note: "41% at p10, matches.",                           created_at: ago(24) },
    { id: "r-5", card_id: "c-0517", user_id: ME,            outcome: "failed", note: "Our 150 kDa band came through at 20% MeOH.",     created_at: ago(3) },
  );

  (tables.reviews as any[]).push(
    { id: "v-1", card_id: "c-0517", reviewer_id: ME,         verdict: "unclear", body: "Which membrane? PVDF and nitrocellulose behave differently here.", created_at: ago(6) },
    { id: "v-2", card_id: "c-0288", reviewer_id: ME,         verdict: "clear",   body: "Ran from the card alone without questions.",                       created_at: ago(23) },
    { id: "v-3", card_id: "c-0412", reviewer_id: "u-okafor", verdict: "clear",   body: "Reproducible from the card as written.",                           created_at: ago(4) },
  );

  (tables.mentorships as any[]).push(
    { id: "g-1", mentor_id: ME, mentee_id: "u-newcomer", note: "Walked me through recording my first card.", created_at: ago(3) },
    { id: "g-2", mentor_id: ME, mentee_id: "u-bhatt",    note: "Transfer conditions for high-MW blots.",     created_at: ago(20) },
  );

  // Reads on the demo researcher's shared cards. Deterministic, so the
  // numbers do not change between reloads; keys are opaque, like the real ones.
  const institutions = [
    "Example Institute · demo data", "Example University · demo data", "Example Agency · demo data",
    "Example Hospital · demo data", "Example College · demo data", "",
  ];
  const vias = ["search", "a question", "another card", "home feed", "a message", "direct"];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const reads = tables.card_reads as any[];
  for (const [card, base] of [["c-0412", 9], ["c-0355", 4], ["c-0602", 5], ["c-0391", 2]] as const) {
    const born = cards.find((c) => c.id === card)!.created_at;
    for (let w = 0; w < 12; w++) {
      const week = weekOf(new Date(Date.now() - w * 7 * 864e5));
      if (week < weekOf(new Date(born))) continue;
      const n = Math.round(base * (0.4 + rnd() * 1.2) * (card === "c-0412" && w === 1 ? 2.2 : 1));
      for (let r = 0; r < n; r++) {
        reads.push({
          card_id: card, week,
          institution: institutions[Math.floor(rnd() * rnd() * institutions.length)],
          via: vias[Math.floor(rnd() * rnd() * vias.length)],
          reader_key: `demo-${card}-${w}-${r}`,
        });
      }
    }
  }
}

/** ISO date of the Monday starting d's week. */
export function weekOf(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  const p = (n: number) => String(n).padStart(2, "0");
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}
