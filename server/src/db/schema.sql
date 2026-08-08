-- =====================================================================
-- Smart Savings Tracker — database schema
-- Normalized to 3NF: users own transactions, goals, and budgets.
-- Compatible with SQLite (dev). PostgreSQL notes are in docs/DATABASE.md.
-- =====================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  email          TEXT    NOT NULL UNIQUE,
  name           TEXT    NOT NULL,
  password_hash  TEXT,                       -- null for federated (Google) accounts
  provider       TEXT    NOT NULL DEFAULT 'email' CHECK (provider IN ('email','google')),
  currency       TEXT    NOT NULL DEFAULT 'INR',
  language       TEXT    NOT NULL DEFAULT 'en',
  theme          TEXT    NOT NULL DEFAULT 'system' CHECK (theme IN ('light','dark','system')),
  monthly_budget REAL    NOT NULL DEFAULT 0,
  email_verified INTEGER NOT NULL DEFAULT 0 CHECK (email_verified IN (0,1)),
  verification_token TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS incomes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             TEXT    NOT NULL,
  source           TEXT    NOT NULL,
  category         TEXT    NOT NULL,
  description      TEXT,
  amount           REAL    NOT NULL CHECK (amount >= 0),
  payment_method   TEXT,
  received_from    TEXT,
  reference_number TEXT,
  recurring        INTEGER NOT NULL DEFAULT 0 CHECK (recurring IN (0,1)),
  notes            TEXT,
  created_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date           TEXT    NOT NULL,
  category       TEXT    NOT NULL,
  subcategory    TEXT,
  description    TEXT,
  amount         REAL    NOT NULL CHECK (amount >= 0),
  payment_method TEXT,
  vendor         TEXT,
  tax            REAL,
  receipt_path   TEXT,
  recurring      INTEGER NOT NULL DEFAULT 0 CHECK (recurring IN (0,1)),
  notes          TEXT,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goals (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT    NOT NULL,
  type                 TEXT    NOT NULL DEFAULT 'Custom Goal',
  target_amount        REAL    NOT NULL CHECK (target_amount >= 0),
  current_amount       REAL    NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  deadline             TEXT,
  monthly_contribution REAL    NOT NULL DEFAULT 0,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category TEXT    NOT NULL,
  month    TEXT,                            -- YYYY-MM, or NULL for a default/recurring budget
  amount   REAL    NOT NULL CHECK (amount >= 0),
  UNIQUE (user_id, category, month)
);

-- Indexes for the common query paths (per-user, ordered by date).
CREATE INDEX IF NOT EXISTS idx_incomes_user_date  ON incomes(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX IF NOT EXISTS idx_expenses_user_cat  ON expenses(user_id, category);
CREATE INDEX IF NOT EXISTS idx_goals_user         ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user       ON budgets(user_id);
