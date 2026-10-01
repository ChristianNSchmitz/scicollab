import { isConfigured } from "@/lib/mode";
import { tables, ME } from "@/lib/demo/store";

/**
 * A little more history for the demo store, so the record has weeks to show
 * and someone else's reuse to point at. Demo mode only, in memory only, and
 * idempotent: it checks for its own rows rather than a flag, so a hot reload
 * of the store module cannot double it.
 */
const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString();

export function ensureRecordSeed() {
  if (isConfigured()) return;
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
}
