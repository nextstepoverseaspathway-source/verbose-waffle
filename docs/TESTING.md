# Testing Guide

## Automated Tests (backend)

The server ships with integration tests using **Vitest** + **Supertest**.
They run against a throwaway SQLite file so they never touch your real data.

```bash
# from repo root
npm test

# or from the server workspace
cd server && npm test
cd server && npm run test:watch   # watch mode
```

The suite (`server/src/app.test.ts`) covers:

- Health check
- User registration + JWT issuance
- Auth enforcement (401 without a token)
- Income create + list
- Expense validation (422 on bad input)
- Dashboard summary computation

### Adding tests

Import the app factory (not the running server) so no port is bound:

```ts
process.env.SQLITE_PATH = '/tmp/test.db';   // set before importing
const { createApp } = await import('./app');
const app = createApp();
```

Then use Supertest to drive endpoints. Follow the existing patterns for
authenticated requests (register/login → capture token → set the
`Authorization` header).

## Type Checking (frontend)

```bash
cd client && npm run lint      # tsc --noEmit
cd client && npm run build     # full type-check + production build
```

## Manual Test Checklist

1. **Auth** — register, log out, log in; try the demo account and Google stub.
2. **Income/Expenses** — add, edit, delete; apply filters and search; export
   CSV and Excel.
3. **Budgets** — set a category budget; confirm spent/remaining/% update and
   the over-budget badge appears past 100%.
4. **Goals** — create a goal, add a contribution, watch progress and ETA
   update; confirm the achievement state at 100%.
5. **Reports** — switch report types and periods; export PDF/CSV/Excel.
6. **Dashboard** — verify totals, health score, insights, charts, upcoming
   bills, and recent transactions; trigger a budget-limit toast (≥ 90%).
7. **Settings** — change currency/theme/language; download a backup, delete
   all data, then restore from the backup; import a sample CSV.
8. **Responsive** — resize to mobile; confirm the bottom nav and stacked
   layouts; toggle dark/light/system themes.

## Sample Data

Import files live in [`docs/sample-data`](./sample-data):

- `sample-income.csv`
- `sample-expenses.csv`

Import them from **Settings → Import Income/Expense CSV**, or seed a full demo
account with `npm run seed`.
