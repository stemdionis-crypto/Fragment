-- Fragment account storage, version 1. Apply once to the Neon PostgreSQL database.
-- This file defines storage only; the current game server does not use it yet.
BEGIN;

CREATE TABLE IF NOT EXISTS fragment_schema_migrations (
  version integer PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fragment_accounts (
  id uuid PRIMARY KEY,
  -- SHA-256 of the random device token; never persist the bearer token itself.
  token_hash char(64) NOT NULL UNIQUE,
  wallet_address text UNIQUE,
  public_name varchar(16),
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_signal_earned integer NOT NULL DEFAULT 0 CHECK (total_signal_earned >= 0),
  wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
  games_played integer NOT NULL DEFAULT 0 CHECK (games_played >= wins),
  fastest_seconds integer CHECK (fastest_seconds > 0),
  owned_skins text[] NOT NULL DEFAULT ARRAY['classic']::text[],
  equipped_skin text NOT NULL DEFAULT 'classic',
  owned_items text[] NOT NULL DEFAULT ARRAY[]::text[],
  loadout jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_day date,
  earned_today integer NOT NULL DEFAULT 0 CHECK (earned_today BETWEEN 0 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fragment_match_results (
  account_id uuid NOT NULL REFERENCES fragment_accounts(id) ON DELETE CASCADE,
  round_id text NOT NULL,
  won boolean NOT NULL,
  practice boolean NOT NULL,
  elapsed_seconds integer NOT NULL CHECK (elapsed_seconds >= 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, round_id)
);

CREATE TABLE IF NOT EXISTS fragment_signal_ledger (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES fragment_accounts(id) ON DELETE CASCADE,
  -- One reward or purchase per account and source, even after retry/restart.
  source_key text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('match_reward', 'skin_purchase', 'item_purchase', 'adjustment')),
  delta integer NOT NULL CHECK (delta <> 0),
  balance_after integer NOT NULL CHECK (balance_after >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, source_key)
);

CREATE INDEX IF NOT EXISTS fragment_accounts_speed_idx
  ON fragment_accounts (fastest_seconds ASC) WHERE wallet_address IS NOT NULL AND fastest_seconds IS NOT NULL;
CREATE INDEX IF NOT EXISTS fragment_accounts_signal_idx
  ON fragment_accounts (total_signal_earned DESC) WHERE wallet_address IS NOT NULL;
CREATE INDEX IF NOT EXISTS fragment_accounts_games_idx
  ON fragment_accounts (games_played DESC) WHERE wallet_address IS NOT NULL;

INSERT INTO fragment_schema_migrations (version) VALUES (1)
ON CONFLICT (version) DO NOTHING;
COMMIT;
