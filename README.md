# SciCollab

A rebuild of the platform against the September 2026 design boards

Desktop at 1440px, as designed. The screens are not redrawn — they are lifted
out of the boards and mounted, and the parts that carry live data are rebuilt
in the same token system.

---

## If you are reading this in ChristianNSchmitz/scicollab

This is a **review copy**. Three things worth knowing before you touch it:

- **The live site does not build from here.** scicollab.net deploys from
  `janmejaydash2002/scicollab-platform` under Janmejay's Vercel account.
  Pushing to this branch changes nothing that is live.
- **You do not need credentials to run it.** `npm install && npm run dev` is
  enough; it falls back to a seeded in-memory store. Ask for the `.env.local`
  values only if you want to work against the real database — and note that
  it is the same project the live site uses, so writes there are public.
- **This branch proposes replacing the old app at the root.** That is a
  proposal, not a decision. If you would rather it sat in a subdirectory
  while the old prototype stays put, say so and it will be restructured.

Live: <https://scicollab.net> · sign in with the demo account Janmejay sends you.

---

## Run it

```bash
npm install
npm run dev     # http://localhost:4400
```

**No credentials needed.** With no Supabase project configured the app runs
off an in-memory store seeded with example content, and sign-in, sign-up and
every write work normally. Use `demo@scicollab.test` / `reproduce`, or create
an account — the invite code is not required in this mode. Everything resets
when the server restarts.

To run against the real database instead, `cp .env.example .env.local` and
fill in the values Janmejay sends you.

`SCICOLLAB_SEED_PASSWORD` is the password given to the seeded demo accounts.
It is deliberately not in the repo: this code is mirrored into a public
repository, and a literal password here would let anyone sign in to the
deployed site.

### Database

Run `supabase/schema.sql` once in the Supabase SQL editor. It is safe to
re-run, and it is written to work on a fresh project **or** on the project the
previous prototype used — where a `profiles` table already exists with
different columns, it adds what is missing rather than leaving the old shape
in place.

Then turn **off** email confirmation in Authentication → Providers → Email,
or the first sign-up cannot sign in.

## What is actually wired

| Area | State |
|---|---|
| Accounts, sessions, route protection | live |
| Profile, six-axis record | live |
| Method cards — create, read, fork, visibility, delete | live |
| Questions and answers, accepting an answer | live |
| Projects and the append-only notebook | live |
| Direct messages, including the reputation gate | live |
| Search across methods, questions, people, projects | live |
| Data, Code, Write, Institution, Notifications, Help | designed, not wired |

A destination that is not wired says so on the screen and names the board it
came from, so the gap stays visible instead of looking like a broken feature.

## OpenAlex sync

Each researcher's author record and publications are synced from OpenAlex by
the ORCID in their profile, every 12 hours: by Vercel Cron in production
(`vercel.json` → `/api/cron/openalex`), by a timer in `instrumentation.ts`
on any long-running server (including `npm run dev`), and as a fallback when
the person opens their You page. "Sync now" is limited to once per 10 minutes.

| Variable | Needed for |
|---|---|
| `SUPABASE_SERVICE_ROLE_KEY` | Writing synced data. Researchers cannot write it themselves. |
| `CRON_SECRET` | The cron route. Without it the route refuses every request. |
| `OPENALEX_API_KEY` | Optional. OpenAlex's free daily allowance is small (1,000 requests at the time of writing); a sync costs one request plus one per 200 works. |
| `SCICOLLAB_SYNC_INTERVAL_HOURS` | Optional, default 12. |

Vercel's Hobby plan runs crons at most once a day; there the visit fallback
covers the second update.

## Layout

| Path | What it is |
|---|---|
| `app/(shell)/` | Everything inside the navigation shell — signed in only |
| `app/boards/` | All 199 extracted artboards, browsable. A build aid |
| `components/Screen.tsx` | Mounts an artboard, and rewrites labelled controls into links |
| `components/ui.tsx` | The house kit: panels, outcome and visibility chips, fields |
| `design/screens/` | Extracted artboards + `manifest.json` |
| `scripts/extract-screens.mjs` | Re-extracts from the design boards |
| `supabase/schema.sql` | The whole database |

To re-extract after the boards change:

```bash
node scripts/extract-screens.mjs ../scicollab/design/boards
```

## Decisions worth knowing

**A null result is not an error.** `outcome` is `success | partial | negative`,
and `negative` is styled in the signal colour, never in the error colour.
`fails_under` is a first-class column, not a note.

**Ownership is resolved on the server.** Every write takes the author from the
session. A client-supplied id is ignored, so nothing can be written on another
account's behalf. Row-level security enforces the same rule at the database.

**Visibility is enforced, not decorative.** A private card is invisible to
everyone but its author — in the policy, not just in the query.

**Reputation is six axes and is never summed.** There is no single number
anywhere that stands for a researcher. Board K5 question 9 argues that
per-researcher metrics must never be obtainable by an institution; that
constraint is why the numbers are kept separate here.

**The messaging gate is real.** An unsolicited first message is held until you
have contributed something — a card, a question or an answer. Anyone you have
already exchanged messages with is never gated, and the block explains itself
and offers a route out.

## Still open

The twelve questions on board K5 are unanswered, and four of them block real
decisions here: the licence default for external contributions, whether
ephemeral content belongs in a permanent record, pseudonymity, and whether an
institution can ever obtain per-researcher metrics. The schema does not
foreclose any of them.
