# Migration: S3V XI (fantasy cricket) → RSFC League (soccer)

## Pivot summary

**Before:** S3V XI was a grassroots *fantasy cricket* app. You built a 15-player squad, picked a starting XI and bench, named a captain and vice-captain for multiplied points, played strategy cards (Full Squad, Skipper x3), and scored from cricket scorecards imported from CricHeroes.

**After:** RSFC League is the in-house league of one real soccer club, RSFC: 18 members plus registered drop-ins.

- Every match day, a seeded, verifiable random draw splits whoever turns up into two sides.
- Points come only from the match scorecard: goal +5, assist +3, own goal −2.
- The only "fantasy" layer left is *Pick 7*, a prediction game played before the draw. There's no squad building, no multipliers and no chips.

What carries over is the night-navy visual identity (`#0C1925`), the condensed uppercase headlines with italic emphasis, the numbered section kickers ("THE IDEA / 001") and the grassroots tone. The framework carries over too: Next.js App Router on Vercel.

## How to migrate the repo

The rebuild is a clean tree, so replace the app instead of editing it piece by piece:

```bash
git checkout -b rsfc-pivot
git rm -r --quiet .                 # stage the removal of the whole old tree (history is kept in git)
cp -R ../rsfc-league/. .            # copy this project in (don't copy node_modules/.next/.data)
git add -A && git commit -m "Pivot S3V XI → RSFC League"
```

Keep your Vercel project. Its Git link, domain and environment variables are separate from the code. Then:

1. Add the env vars from `.env.example`.
2. Connect Upstash Redis.
3. Redeploy.

## Deletion checklist (cricket legacy)

Tick each item off against the old codebase. Every item is absent from the new tree. The route and feature names come from the live site and its build notes.

**Routes and pages**

- [ ] `/tournaments`: tournament chooser ("Choose a tournament")
- [ ] `/players`: cricket player records and imported player stats
- [ ] `/match-centre`: CricHeroes-style scorecard entry and import
- [ ] `/leaderboard`: fantasy-points leaderboard. Replaced by `/table`.
- [ ] `/points`: "Fantasy Points. Fully Explained". Replaced by `/rules`.
- [ ] Landing anchors `#builder` ("The Selection Room") and `#about`

**Cricket Draft feature**

- [ ] 15-player squad builder
- [ ] Starting XI and bench selection, including bench swaps
- [ ] Captain and vice-captain picker, plus the C/VC point multipliers
- [ ] Swap mechanics and transfer logic
- [ ] Strategy deck: "Full Squad" and "Skipper x3" chips, and any chip state or "Active Chip" stat
- [ ] Selection Room stats bar (Round Points, Selected, Starting, Active Chip)

**Scoring and data**

- [ ] All cricket point logic: runs, wickets, overs, economy, strike rate, catches, stumpings, run-outs, maidens, milestones, captain double and triple
- [ ] CricHeroes import code, parsers, fixtures and the "not claimed as verified CricHeroes data" disclaimer
- [ ] Canterbury vs Kanata demo data and any fictional demo squads
- [ ] Old player-record JSON and seed files

**Copy and vocabulary.** Search the old tree and confirm every hit is gone:

```bash
grep -rniE "\bXI\b|eleven|captain|vice|skipper|full squad|wicket|\bruns?\b|overs?\b|innings|cricheroes|canterbury|kanata|bench|swap|chip" --include=*.{ts,tsx,js,jsx,md,json,css} .
```

- [ ] Title and meta "S3V XI | Your League. Your Eleven." → "RSFC League | Your Club. Your Seven."
- [ ] Eyebrow "Free to play · Grassroots fantasy cricket" → "Free to play · Grassroots soccer · RSFC"
- [ ] Footer "independent fictional demo" disclaimer. RSFC is a real club with real data now.

**Run this grep on the new tree:**

```bash
grep -rniE "wicket|cricheroes|skipper|captain|\bXI\b" app components lib config
```

It should return nothing.

## The Predictor League module (`/league`)

The earlier build notes describe a separate exact-score Predictor League at `/league`. It has its own email/password auth and SQLite/Postgres storage. It isn't cricket, but RSFC League doesn't use it, and Pick 7 covers the prediction itch.

My recommendation is to remove it with the rest. That leaves one storage backend (Redis) and no user accounts to look after.

To keep it anyway, copy its `app/league`, `lib/league/*` (rename it to avoid clashing with this project's `lib/league`) and its env vars across. It's self-contained.

## Data

There's nothing to migrate. Cricket fantasy data has no meaning in the soccer league. RSFC League starts empty, with the roster in `config/club.ts`.
