-- Durable profile state used by server/account-store.ts. No bearer tokens.
-- Older normalized tables are retained; never drop existing user data.
BEGIN;
CREATE TABLE IF NOT EXISTS fragment_account_state (
  id smallint PRIMARY KEY CHECK (id = 1),
  revision bigint NOT NULL DEFAULT 0,
  accounts jsonb NOT NULL DEFAULT '[]',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO fragment_account_state (id) VALUES (1) ON CONFLICT DO NOTHING;
INSERT INTO fragment_schema_migrations (version) VALUES (2) ON CONFLICT DO NOTHING;
COMMIT;
