-- =====================================================================
-- Smart Savings Tracker — PostgreSQL schema (production)
-- Mirrors schema.sql (SQLite). Dates are stored as TEXT 'YYYY-MM-DD' so the
-- dialect-neutral substr(date, 1, 7) / substr(date, 1, 4) queries work
-- identically on both backends. Booleans use SMALLINT 0/1 to match the code.
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  password_hash  TEXT,
  provider       TEXT    NOT NULL DEFAULT 'email' CHECK (provider IN ('email','google')),
  currency       TEXT    NOT NULL DEFAULT 'INR',
  language       TEXT    NOT NULL DEFAULT 'en',
  theme          TEXT    NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  monthly_budget DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incomes (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             TEXT    NOT NULL,
  source           TEXT    NOT NULL,
  category         TEXT    NOT NULL,
  description      TEXT,
  amount           DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
  payment_method   TEXT,
  received_from    TEXT,
  reference_number TEXT,
  recurring        SMALLINT NOT NULL DEFAULT 0 CHECK (recurring IN (0,1)),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS expenses (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date           TEXT    NOT NULL,
  category       TEXT    NOT NULL,
  subcategory    TEXT,
  description    TEXT,
  amount         DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
  payment_method TEXT,
  vendor         TEXT,
  tax            DOUBLE PRECISION,
  receipt_path   TEXT,
  recurring      SMALLINT NOT NULL DEFAULT 0 CHECK (recurring IN (0,1)),
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS goals (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT    NOT NULL,
  type                 TEXT    NOT NULL DEFAULT 'Custom Goal',
  target_amount        DOUBLE PRECISION NOT NULL CHECK (target_amount >= 0),
  current_amount       DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline             TEXT,
  monthly_contribution DOUBLE PRECISION NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS budgets (
  id       SERIAL PRIMARY KEY,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT    NOT NULL,
  month    TEXT,
  amount   DOUBLE PRECISION NOT NULL CHECK (amount >= 0),
  UNIQUE (user_id, category, month)
);

CREATE INDEX IF NOT EXISTS idx_incomes_user_date  ON incomes(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_cat  ON expenses(user_id, category);
CREATE INDEX IF NOT EXISTS idx_goals_user         ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user       ON budgets(user_id);
