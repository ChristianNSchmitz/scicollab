/**
 * Houses and rooms.
 *
 * A house is a broad discipline. A room is a technique, method or shared
 * problem. The important property is that **rooms are global and cross-listed
 * into several houses** rather than nested inside one.
 *
 * A western blot fails the same way in neuroscience and in zoology. If each
 * house owned its own copy of that room, the corpus would fragment along
 * exactly the disciplinary lines this platform exists to cut across, and the
 * same failure would be recorded three times without anyone finding the other
 * two. Houses therefore answer "who am I and what should my feed show on day
 * one"; rooms answer "what is this about".
 *
 * The taxonomy is curated rather than user-generated. That is the safer
 * default at launch — an empty directory of user-made tags is worse than a
 * small deliberate one — and it is open question Q2 on the communication
 * deck. Moving this into the database later is a migration, not a redesign:
 * everything below is referenced by string id.
 */

export type House = { id: string; name: string; blurb: string };

export type Room = {
  id: string;
  name: string;
  blurb: string;
  /** Every house this room appears in. Order is not significant. */
  houses: string[];
};

export const HOUSES: House[] = [
  { id: "biology",        name: "Biology & life sciences", blurb: "Cell and molecular biology, genetics, physiology." },
  { id: "neuroscience",   name: "Neuroscience",            blurb: "From single channels to systems and behaviour." },
  { id: "chemistry",      name: "Chemistry",               blurb: "Synthesis, analytical chemistry, biochemistry." },
  { id: "geophysics",     name: "Geophysics & earth",      blurb: "Seismology, geochemistry, remote sensing, field science." },
  { id: "zoology",        name: "Zoology & ecology",       blurb: "Organismal biology, behaviour, field ecology." },
  { id: "bioinformatics", name: "Computation & informatics", blurb: "Pipelines, statistics, reproducible analysis." },
  { id: "medicine",       name: "Medicine & clinical",     blurb: "Clinical research, trials, translational work." },
  { id: "materials",      name: "Materials & engineering", blurb: "Characterisation, fabrication, instrumentation." },
];

export const ROOMS: Room[] = [
  // Bench techniques — these are the ones that must not fragment.
  { id: "western-blot",     name: "Western blot",        blurb: "Transfer, antibodies, and everything that goes wrong above 100 kDa.", houses: ["biology", "neuroscience", "zoology", "medicine"] },
  { id: "transfection",     name: "Transfection",        blurb: "Lipofection, electroporation, passage effects.",                      houses: ["biology", "neuroscience", "medicine"] },
  { id: "crispr",           name: "CRISPR & editing",    blurb: "Guide design, efficiency, off-targets.",                              houses: ["biology", "neuroscience", "zoology", "medicine"] },
  { id: "cell-culture",     name: "Cell culture",        blurb: "Contamination, passage number, media and incubators.",                houses: ["biology", "neuroscience", "medicine"] },
  { id: "microscopy",       name: "Microscopy & imaging",blurb: "Sample prep, acquisition settings, artefacts.",                       houses: ["biology", "neuroscience", "materials", "zoology"] },
  { id: "mass-spec",        name: "Mass spectrometry",   blurb: "Sample prep, fragmentation, quantification.",                         houses: ["chemistry", "biology", "materials", "medicine"] },
  { id: "electrophysiology",name: "Electrophysiology",   blurb: "Patch clamp, recordings, noise and rigs.",                            houses: ["neuroscience", "biology"] },
  { id: "rna-seq",          name: "RNA-seq",             blurb: "Library prep through differential expression.",                       houses: ["biology", "bioinformatics", "medicine", "neuroscience"] },
  { id: "field-sampling",   name: "Field sampling",      blurb: "Collection, preservation and the things that fail offline.",          houses: ["geophysics", "zoology", "biology"] },
  { id: "spectroscopy",     name: "Spectroscopy",        blurb: "NMR, IR, Raman — acquisition and interpretation.",                    houses: ["chemistry", "materials", "geophysics"] },

  // Shared problems — every house, by design.
  { id: "negative-results", name: "Negative results",    blurb: "Runs that did not work, recorded so nobody repeats them.",            houses: HOUSES.map((h) => h.id) },
  { id: "reproducibility",  name: "Reproducibility",     blurb: "Replication attempts, protocol drift, and why numbers move.",         houses: HOUSES.map((h) => h.id) },
  { id: "stats-and-code",   name: "Stats & code",        blurb: "Analysis choices, pipelines, and code that has to be trusted.",       houses: ["bioinformatics", "medicine", "geophysics", "materials", "biology"] },
  { id: "grants-careers",   name: "Grants & careers",    blurb: "Funding, mentorship, and moving between groups.",                     houses: HOUSES.map((h) => h.id) },
  { id: "instruments",      name: "Instruments & kit",   blurb: "Calibration, drift, booking and what broke this week.",               houses: HOUSES.map((h) => h.id) },

  // Community — every house. Where people arrive, and where off-topic goes so
  // the technical rooms stay searchable.
  { id: "introductions",    name: "Introductions",       blurb: "Say who you are, what you work on and what you could use help with.", houses: HOUSES.map((h) => h.id) },
  { id: "common-room",      name: "Common room",         blurb: "Off-topic, kindly — weekends, hobbies, the rest of life.",           houses: HOUSES.map((h) => h.id) },
];

// ── lookups ───────────────────────────────────────────────────────────────
export const houseById = (id: string) => HOUSES.find((h) => h.id === id) ?? null;
export const roomById  = (id: string) => ROOMS.find((r) => r.id === id) ?? null;

export const roomsInHouse = (houseId: string) => ROOMS.filter((r) => r.houses.includes(houseId));

/** Houses a room appears in, resolved to objects. */
export const housesOfRoom = (roomId: string) =>
  (roomById(roomId)?.houses ?? []).map(houseById).filter(Boolean) as House[];

/** A room shown outside its house needs to say where else it lives. */
export const isShared = (roomId: string) => (roomById(roomId)?.houses.length ?? 0) > 1;

// ── post intent ───────────────────────────────────────────────────────────
/**
 * Intent is required and is a single click. It is what makes "who is looking
 * for collaborators" an answerable question, and it is deliberately not free
 * tagging: a tagging chore at the moment of posting is where people give up.
 * Topic comes from the room and from whatever artifact is attached.
 */
export type Intent = "update" | "result" | "data_question" | "general" | "collab";

export const INTENTS: { id: Intent; label: string; hint: string; needsArtifact: boolean }[] = [
  { id: "result",        label: "A result worth sharing",   hint: "Something worked, partly worked, or failed — and the card is attached.", needsArtifact: true },
  { id: "data_question", label: "A question about my data", hint: "You are stuck on your own run and the card comes with the question.",    needsArtifact: true },
  { id: "general",       label: "A general question",       hint: "Grants, mentorship, careers, or how other groups do something.",         needsArtifact: false },
  { id: "collab",        label: "A call for collaborators", hint: "What you need, what you offer, and by when.",                            needsArtifact: false },
  { id: "update",        label: "News or an update",        hint: "A paper out, a talk, a picture from the bench, a link worth reading.",   needsArtifact: false },
];

export const intentById = (id: string) => INTENTS.find((i) => i.id === id) ?? null;

