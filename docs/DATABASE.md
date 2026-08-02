# Database Schema

The application uses **SQLite** in development (zero-config, file-based) and is
designed to run on **PostgreSQL** in production. The schema is normalized to
**third normal form (3NF)**: every transaction, goal, and budget belongs to a
single `users` row, and there are no repeating groups or transitive
dependencies.

The canonical definition lives in
[`server/src/db/schema.sql`](../server/src/db/schema.sql).

## Entity–Relationship Overview

```
                ┌─────────────┐
                │    users    │
                │─────────────│
                │ id (PK)     │
                │ email (UQ)  │
                │ name        │
                │ password_h. │
                │ provider    │
                │ currency    │
                │ language    │
                │ theme       │
                │ monthly_bud.│
                └──────┬──────┘
                       │ 1
         ┌─────────────┼───────────────┬───────────────┐
         │ N           │ N             │ N             │ N
   ┌─────▼─────┐ ┌─────▼─────┐  ┌──────▼─────┐  ┌──────▼─────┐
   │  incomes  │ │ expenses  │  │   goals    │  │  budgets   │
   └───────────┘ └───────────┘  └────────────┘  └────────────┘
```

All child tables reference `users(id)` with
`ON DELETE CASCADE`, so deleting a user removes all of their data atomically.

## Tables

### `users`
| Column | Type | Notes |
| --- | --- | --- |
| `id` | INTEGER PK | Auto-increment |
| `email` | TEXT | **Unique**, lower-cased |
| `name` | TEXT | Display name |
| `password_hash` | TEXT | `NULL` for Google accounts |
| `provider` | TEXT | `email` \| `google` |
| `currency` | TEXT | ISO code (default `INR`) |
| `language` | TEXT | Language code (default `en`) |
| `theme` | TEXT | `light` \| `dark` \| `system` |
| `monthly_budget` | REAL | Overall monthly budget |
| `created_at` | TEXT | Timestamp |

### `incomes`
`id`, `user_id (FK)`, `date`, `source`, `category`, `description`, `amount`,
`payment_method`, `received_from`, `reference_number`, `recurring (0/1)`,
`notes`, `created_at`.

### `expenses`
`id`, `user_id (FK)`, `date`, `category`, `subcategory`, `description`,
`amount`, `payment_method`, `vendor`, `tax`, `receipt_path`,
`recurring (0/1)`, `notes`, `created_at`.

### `goals`
`id`, `user_id (FK)`, `name`, `type`, `target_amount`, `current_amount`,
`deadline`, `monthly_contribution`, `created_at`.

### `budgets`
`id`, `user_id (FK)`, `category`, `month (YYYY-MM or NULL)`, `amount`.
Unique on `(user_id, category, month)` so upserts are deterministic. A `NULL`
month is a recurring default that applies to any month without an explicit
override.

## Indexes

```sql
idx_incomes_user_date   (user_id, date)
idx_expenses_user_date  (user_id, date)
idx_expenses_user_cat   (user_id, category)
idx_goals_user          (user_id)
idx_budgets_user        (user_id)
```

These cover the hot query paths: per-user listing ordered by date, and
per-user category aggregation for reports and budgets.

## Dual backend: SQLite and PostgreSQL

The app runs on **both** backends behind one small async adapter
(`server/src/db/database.ts`):

- **SQLite** (`better-sqlite3`) by default — zero-config local development.
- **PostgreSQL** (`pg`) when `DATABASE_URL` is set — durable production storage.

There are two schema files with equivalent structure:
`schema.sql` (SQLite) and `schema.postgres.sql` (Postgres). The type mapping:

| SQLite | PostgreSQL |
| --- | --- |
| `INTEGER PRIMARY KEY AUTOINCREMENT` | `SERIAL PRIMARY KEY` |
| `REAL` | `DOUBLE PRECISION` |
| `datetime('now')` default | `now()` (`TIMESTAMPTZ`) |
| boolean as `INTEGER 0/1` | `SMALLINT 0/1` |

### Dialect-neutral queries

Application queries are written in a subset that behaves identically on both
engines, so the routes are backend-agnostic:

- Dates are stored as `TEXT` in `YYYY-MM-DD` form, and month/year grouping uses
  `substr(date, 1, 7)` / `substr(date, 1, 4)` instead of SQLite's `strftime`
  or Postgres's `to_char`.
- Inserts that need the new id use `INSERT … RETURNING id`.
- Upserts use `INSERT … ON CONFLICT … DO UPDATE … RETURNING *`.
- The adapter translates `?` and `@named` placeholders to Postgres `$1, $2, …`.

Both paths are covered by tests: `app.test.ts` (SQLite) and
`app.postgres.test.ts` (Postgres via in-memory `pg-mem`). See
[DEPLOYMENT.md](./DEPLOYMENT.md) for enabling Postgres in production.
