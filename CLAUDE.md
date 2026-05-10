@AGENTS.md
# SciCollab — CLAUDE.md

## What this is
GitHub × Stack Overflow × Database for scientists. A platform where 
researchers share experiment data (successful and failed), ask peer Q&A 
grounded in structured artifacts, and fork/reuse protocols.

## Stack
- Frontend: Next.js 14 (App Router), TypeScript, Tailwind
- Backend: tRPC, Prisma, PostgreSQL
- Auth: NextAuth with ORCID SSO
- Infra: Vercel (frontend), Railway (DB)

## Key concept: Method Card
The atomic unit of the platform. Schema: title, protocol_version, 
reagents[], conditions{}, outcome (SUCCESS|PARTIAL|FAILURE), 
failure_context, tags[], author_id, lab_id, created_at.
All Q&A threads and forks link back to a Method Card ID.

## Commands
- `npm run dev` — start local dev server
- `npm run test` — run tests
- `npm run db:push` — push Prisma schema changes
- `npm run db:studio` — open Prisma Studio

## Conventions
- One feature per branch, named feature/<name>
- PRs must pass tests before merge
- Method Card schema changes need both team members to agree first
