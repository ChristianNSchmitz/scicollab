# Access tests (P0)

Checks that nobody can do or read what they should not. Runs on the demo store:
no database, no accounts, no network.

```
npm run test:access     # these tests only
npm test                # all tests (CI runs this)
```

## What is tested

- **Every server action, signed out.** Found automatically in `app/actions/`,
  so a new action is covered the day it is added. Each must write nothing and
  refuse. The few actions meant for visitors are listed in `PUBLIC`
  (`actions.test.mts`).
- **Owner vs stranger** (`cases.mts`). For each action on someone's content:
  the person allowed to act really changes something, and Priya (`u-priya`,
  in no group, project or chat, not a moderator) changes nothing.
- **Routes** (`routes.test.mts`): project file downloads, post files, group
  files, personal exports, the two scheduled jobs (secret), the front-page
  showcase (public items only, no e-mail addresses), and the e-mail link
  landing page (never sends people to another site).

## Known gaps

`KNOWN_GAPS` in `actions.test.mts` lists holes found and not yet fixed. They
show as `# TODO` in the output and do not make the build red. When a fix is
in, delete its line: the test then guards the fix.

## Not tested here

The Supabase database rules (RLS). The database is going to move, so the
checks are made on the code. Where the code relies on a database rule alone,
that is a known gap.

## How it works

`register.mjs` loads `hooks.mjs`, which resolves `@/` paths and replaces
`next/headers`, `next/navigation` and `next/cache` with the stand-ins in
`mocks/`. `as("u-…")` picks the signed-in member; `reset()` puts the demo
data back before each test; `attempt()` records whether a call redirected,
failed, returned a value and which tables it changed.
