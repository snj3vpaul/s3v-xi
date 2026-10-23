# Architecture

Milestone 1 is browser-only: Next.js App Router, React and TypeScript. Data in `lib/demo.ts` is fictional; state in `components/SquadDemo.tsx` is transient. Rules are pure functions in `lib/fantasy.ts` and verified with Vitest. Chips are **demo score previews**, not real inventory transactions.

Planned backend: Supabase authentication and PostgreSQL with row level security; server-side tournament, fixture and roster services; immutable round squad snapshots; transfer history; authoritative chip inventory; versioned scoring rules; validated scorecard imports with version history and idempotent rescoring. Never assume the client controls deadline locks or awardable points.
