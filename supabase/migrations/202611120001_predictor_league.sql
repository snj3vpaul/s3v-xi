-- Predictor League (scoreline picks between friends; no money, no wagering).
-- The app applies this automatically on boot when DATABASE_URL is set; this file is a
-- reviewable copy generated from lib/league/schema.ts. Safe to run more than once.
-- RLS is enabled with no policies so Supabase's public REST API cannot read these tables;
-- the Next.js server connects with the database role (bypasses RLS) via DATABASE_URL.

CREATE TABLE IF NOT EXISTS league_settings (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  invite_code TEXT NOT NULL,
  demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS league_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  avatar TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('admin','player')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
  password_hash TEXT NOT NULL,
  joined_at TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE TABLE IF NOT EXISTS league_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES league_users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS league_sessions_user ON league_sessions(user_id);

CREATE TABLE IF NOT EXISTS league_rounds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','scored')),
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS league_fixtures (
  id TEXT PRIMARY KEY,
  round_id TEXT NOT NULL REFERENCES league_rounds(id) ON DELETE CASCADE,
  home_team TEXT NOT NULL,
  away_team TEXT NOT NULL,
  kickoff_at TEXT NOT NULL,
  deadline_at TEXT NOT NULL,
  actual_home_goals INTEGER CHECK (actual_home_goals IS NULL OR actual_home_goals >= 0),
  actual_away_goals INTEGER CHECK (actual_away_goals IS NULL OR actual_away_goals >= 0),
  result_entered_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS league_fixtures_round ON league_fixtures(round_id);

CREATE TABLE IF NOT EXISTS league_picks (
  id TEXT PRIMARY KEY,
  fixture_id TEXT NOT NULL REFERENCES league_fixtures(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES league_users(id) ON DELETE CASCADE,
  predicted_home_goals INTEGER NOT NULL CHECK (predicted_home_goals >= 0),
  predicted_away_goals INTEGER NOT NULL CHECK (predicted_away_goals >= 0),
  submitted_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  locked INTEGER NOT NULL DEFAULT 0,
  UNIQUE (fixture_id, user_id)
);

CREATE INDEX IF NOT EXISTS league_picks_user ON league_picks(user_id);

CREATE TABLE IF NOT EXISTS league_points_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES league_users(id) ON DELETE CASCADE,
  fixture_id TEXT NOT NULL REFERENCES league_fixtures(id) ON DELETE CASCADE,
  round_id TEXT NOT NULL REFERENCES league_rounds(id) ON DELETE CASCADE,
  points_awarded INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('exact','outcome','miss')),
  rules_version TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  UNIQUE (user_id, fixture_id)
);

CREATE INDEX IF NOT EXISTS league_ledger_round ON league_points_ledger(round_id);

ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE league_users ENABLE ROW LEVEL SECURITY;

ALTER TABLE league_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE league_rounds ENABLE ROW LEVEL SECURITY;

ALTER TABLE league_fixtures ENABLE ROW LEVEL SECURITY;

ALTER TABLE league_picks ENABLE ROW LEVEL SECURITY;

ALTER TABLE league_points_ledger ENABLE ROW LEVEL SECURITY;
