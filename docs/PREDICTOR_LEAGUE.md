# Predictor League

A private scoreline-prediction game for a group of friends, living at `/league`. Friends join with an invite code, predict the exact final score of each fixture before it locks, and earn points when the admin enters the real result. It sits alongside the S3V XI cricket features and shares nothing with them except the Next.js app.

## For fun only: no gambling, ever

- No money, deposits, withdrawals, entry fees, wagers, stakes, odds, prizes or cash conversion.
- No bookmaker links, betting ads or gambling-affiliate integrations.
- Points are virtual bragging rights with no value outside the app.

If a future request drifts toward wagering, don't build it. Offer a fun alternative instead, such as a new achievement, a bonus scoring rule, a season trophy or a forfeit chosen by the group.

## Running it

```bash
npm install
npm run dev            # http://localhost:3000/league
```

With no configuration, the league uses a SQLite file at `.data/league.sqlite` (built into Node 22) and seeds a demo on first launch:

- 8 players, 2 fully scored matchweeks (so rank arrows show) and a live matchweek with one locked fixture and three open ones.
- Every demo account uses the password `demo-league`. The admin is `commish@demo.league`; players include `priya@demo.league`, `tom@demo.league` and `leo@demo.league`. The sign-in page has one-tap buttons to fill these in.
- `npm run league:reset` deletes the local data. **Restart the dev server**, and the demo reseeds on the next request.

## Production (Vercel + Postgres/Supabase)

Vercel's filesystem is temporary, so production needs Postgres:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. For Supabase use the **transaction pooler** URI (port 6543); the app disables prepared statements for pooler compatibility. Server-only: never prefix it with `NEXT_PUBLIC_`. |
| `LEAGUE_ADMIN_EMAIL` | The person who signs up with this email becomes admin and doesn't need an invite code. |
| `LEAGUE_NAME` | Optional starting league name (can be renamed in Admin). |
| `LEAGUE_DEMO_SEED` | `1` seeds the demo into an empty database, `0` never seeds. The default is to seed only when `DATABASE_URL` is unset. |
| `LEAGUE_SQLITE_PATH` | Optional custom SQLite file path for self-hosting without Postgres. |

The app creates its tables on first request (idempotent `CREATE TABLE IF NOT EXISTS`). `supabase/migrations/202611120001_predictor_league.sql` is the same schema for review or manual apply. Row Level Security is enabled with **no policies** on every `league_*` table, so Supabase's public REST API can't read them; only the Next.js server (connecting as the database owner) can.

Without `DATABASE_URL` on Vercel, the app still boots on a temporary `/tmp` SQLite file in demo mode. That's fine for a preview, but data disappears between cold starts.

## Starting a league

1. Deploy with `DATABASE_URL` and `LEAGUE_ADMIN_EMAIL` set.
2. Visit `/league/join` and sign up with the admin email (no invite code needed).
3. **Admin → Invite & settings**: copy the invite link and drop it in the group chat. **New code** invalidates old links.
4. **Admin → Rounds & results**: create a round ("Matchweek 1"), then add fixtures with kick-off times in your local time. They're stored in UTC and everyone sees their own timezone. Picks lock at kick-off unless you set an earlier deadline.
5. After each match, type the score and press **Save result**. Points and the leaderboard update immediately. **Update** corrects a result; **Clear** removes it.
6. **Lock picks now** closes a whole round early and reveals everyone's picks. A round becomes **Scored** automatically once every result is in.
7. **Members**: **Remove** signs a player out, hides them from the table and blocks new picks while keeping their history. **Restore** brings them back.

## Scoring

All rules live in `lib/league/config.ts` (`SCORING_RULES`):

| Prediction vs result | Points | Ledger reason |
|---|---|---|
| Exact scoreline | 3 | `exact` |
| Right outcome (home win / draw / away win), wrong score | 1 | `outcome` |
| Wrong outcome | 0 | `miss` |

`bonuses` is a list of optional extra rules (`{ id, label, points, onlyWhen, applies(pick, result) }`). A commented clean-sheet example is included. After changing rules, bump `version` and press **Recalculate all points** in Admin.

Leaderboard rules:

- Standard competition ranking: players level on points share a rank (1, 2, =3, =3, 5). Within a tie, more exact scores are listed first.
- Movement arrows compare the table now with the table before the most recent round that has results.
- Titles are recomputed from history. A title shared by more than three people isn't awarded.
  - 🔮 **Score Oracle**: most exact scores.
  - 📈 **Consistent**: longest run of scoring picks, minimum 3.
  - 🤝 **Draw Whisperer**: most draws called, minimum 2.
  - 🌞 **Optimist**: most bold misses (5+ goals or a 3+ goal margin).

## How it's built

| Piece | Where |
|---|---|
| Rules & limits | `lib/league/config.ts` |
| Pure scoring, ranking, achievements (unit-tested) | `lib/league/scoring.ts` |
| SQL adapter: SQLite (`node:sqlite`) or Postgres (`postgres`), always parameterised | `lib/league/db.ts`, `lib/league/schema.ts` |
| Business logic: auth, rounds, picks, results → ledger, leaderboard, members | `lib/league/service.ts` |
| Password hashing (scrypt), session tokens, invite codes | `lib/league/crypto.ts` |
| Session cookie, origin check, rate limits, error handling for every API route | `lib/league/session.ts`, `lib/league/rate-limit.ts` |
| Demo data | `lib/league/seed.ts` |
| API routes | `app/api/league/**` |
| Pages (server components) | `app/league/**` |
| UI components (podium, confetti, count-up, score steppers, admin) | `components/league/**`, styles in `app/league/league.css` |

### API

All routes are JSON. Writes require a same-origin `Origin` header, and auth uses an HttpOnly `league_session` cookie.

| Method & path | Who | Body |
|---|---|---|
| `POST /api/league/auth/signup` | anyone (rate-limited) | `{ name, email, password, avatar, inviteCode }` |
| `POST /api/league/auth/login` / `logout` | anyone (rate-limited) | `{ email, password }` |
| `GET/PATCH /api/league/me` | member | `{ name?, avatar? }` |
| `POST /api/league/picks` | member | `{ picks: [{ fixtureId, home, away }] }` returns `{ saved, rejected }` |
| `GET /api/league/rounds/:id` | member | the round with your picks; others' picks only after lock |
| `GET /api/league/leaderboard` | member | standings, per-round points, movement, titles |
| `GET/POST /api/league/admin/rounds` | admin | `{ name }` |
| `PATCH/DELETE /api/league/admin/rounds/:id` | admin | `{ name?, status?: "open" \| "locked" }` |
| `POST /api/league/admin/rounds/:id/fixtures` | admin | `{ homeTeam, awayTeam, kickoffAt, deadlineAt? }` (ISO UTC) |
| `PATCH/DELETE /api/league/admin/fixtures/:id` | admin | same fields as create |
| `PUT /api/league/admin/fixtures/:id/result` | admin | `{ home, away }` or `{ clear: true }` |
| `PATCH /api/league/admin/members/:id` | admin | `{ status: "active" \| "removed" }` |
| `PATCH /api/league/admin/league` | admin | `{ name?, regenerateInvite?: true }` |
| `POST /api/league/admin/recompute` | admin | — |

### Safety notes

- **Deadlines** are enforced on the server against its own clock, inside a transaction. The upsert also refuses to change a pick already flagged `locked`.
- **Pick secrecy**: other players' picks are only included in API responses once a fixture locks.
- **Duplicates**: `UNIQUE (fixture_id, user_id)` plus an upsert, and duplicate fixture ids in one request are rejected.
- **Validation**: scores must be whole numbers from 0 to 20. Names are trimmed, stripped of control characters and length-capped. Avatars come from a fixed list.
- **Passwords**: scrypt (N=2^15, r=8, p=1) with per-user salt, and a constant-time compare. Sign-in runs a hash even for unknown emails.
- **Sessions**: 32 random bytes; only the SHA-256 is stored. The cookie is HttpOnly and SameSite=Lax, plus Secure in production. Removing a member deletes their sessions.
- **CSRF**: every non-GET league route rejects requests whose `Origin` doesn't match the host.
- **Rate limits**: per IP (login, signup) or per user (picks, admin). These are in-memory per server instance, which is enough for a friends league; use a shared store if you need strict global limits.
- **XSS**: everything renders through React escaping. The only inline script is a constant theme snippet.

## Tests

```bash
npm test                                                      # SQLite, in-memory
TEST_DATABASE_URL=postgres://user@host:5432/db npm test       # also runs the service suite on Postgres (drops league_* tables in that DB!)
```
