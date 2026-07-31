# API Reference

Base URL (development): `http://localhost:4000/api`

All responses are JSON. Authenticated endpoints require an
`Authorization: Bearer <token>` header. Errors use the shape:

```json
{ "error": "Human-readable message" }
```

Validation errors return HTTP `422` with a `details` array.

---

## Authentication

### `POST /auth/register`
Create an email account.

**Body:** `{ "name": string, "email": string, "password": string (min 6) }`
**Response `201`:** `{ "token": string, "user": PublicUser }`

### `POST /auth/login`
**Body:** `{ "email": string, "password": string }`
**Response `200`:** `{ "token": string, "user": PublicUser }`

### `POST /auth/google`
Federated sign-in. In production, verify a Firebase ID token first (see
[DEPLOYMENT.md](./DEPLOYMENT.md)); this endpoint upserts the user by email.

**Body:** `{ "email": string, "name"?: string }`
**Response `200`:** `{ "token": string, "user": PublicUser }`

### `GET /auth/me` 🔒
**Response `200`:** `{ "user": PublicUser }`

---

## Metadata

### `GET /meta`
Static reference data for dropdowns (no auth).

**Response:** `{ incomeCategories, expenseCategories, paymentMethods, goalTypes, currencies }`

---

## Income 🔒

### `GET /income`
List with optional filters (all query params optional):

| Param | Description |
| --- | --- |
| `from`, `to` | ISO date range (`YYYY-MM-DD`) |
| `month` | `YYYY-MM` |
| `year` | `YYYY` |
| `category` | exact category |
| `payment_method` | exact method |
| `minAmount`, `maxAmount` | numeric bounds |
| `q` | free-text search (description, notes, category, source, received-from) |

**Response:** `{ "data": Income[] }`

### `POST /income`
**Body:**
```json
{
  "date": "2026-07-01",
  "source": "Monthly Salary",
  "category": "Salary",
  "description": "Net pay",
  "amount": 85000,
  "payment_method": "Net Banking",
  "received_from": "Employer Ltd",
  "reference_number": "TXN123",
  "recurring": true,
  "notes": "…"
}
```
**Response `201`:** `{ "data": Income }`

### `GET /income/:id` · `PUT /income/:id` · `DELETE /income/:id`
Read / update / delete a single entry (scoped to the current user).
`DELETE` returns `204`.

---

## Expenses 🔒

Same filter/search surface as income (`q` also matches subcategory & vendor).

### `POST /expenses`
**Body:**
```json
{
  "date": "2026-07-05",
  "category": "Food",
  "subcategory": "Groceries",
  "description": "Weekly groceries",
  "amount": 3200,
  "payment_method": "Debit Card",
  "vendor": "BigBasket",
  "tax": 160,
  "recurring": false,
  "notes": "…"
}
```

### `GET /expenses` · `GET/PUT/DELETE /expenses/:id`
As with income.

### `POST /expenses/:id/receipt`
Multipart upload (`receipt` field, image/PDF, ≤ 5 MB).
**Response:** `{ "data": { "receipt_path": "/uploads/…" } }`

---

## Goals 🔒

### `GET /goals`
**Response:** `{ "data": Goal[] }` — each `Goal` includes a computed `progress` (0–100).

### `POST /goals` · `PUT /goals/:id`
**Body:** `{ name, type, target_amount, current_amount?, deadline?, monthly_contribution? }`

### `POST /goals/:id/contribute`
Add to `current_amount`. **Body:** `{ "amount": number > 0 }`

### `DELETE /goals/:id` → `204`

---

## Budgets 🔒

### `GET /budgets?month=YYYY-MM`
**Response:** `{ "month": string, "data": BudgetRow[] }` where each row has
`amount`, `spent`, `remaining`, `percentUsed`.

### `PUT /budgets`
Upsert a category budget.
**Body:** `{ "category": string, "month"?: "YYYY-MM", "amount": number }`

### `DELETE /budgets/:id` → `204`

---

## Dashboard & Analytics 🔒

### `GET /dashboard`
Home summary for the current month: `totalIncome`, `totalExpenses`,
`totalSavings`, `savingsRate`, `monthlyBudget`, `remainingBudget`,
`budgetUsedPercent`, `highestExpenseCategory`, `goalProgress`, `healthScore`,
`upcomingBills`, `recentTransactions`.

### `GET /dashboard/savings`
`{ monthlySavings, yearlySavings, averageSavings, savingsRate, bestMonth, worstMonth }`

### `GET /dashboard/insights`
`{ "insights": string[] }` — heuristic monthly insights.

### `GET /dashboard/charts?year=YYYY`
`{ "series": MonthlyPoint[], "expensePie": { category, total }[] }`

---

## Reports 🔒

| Endpoint | Description |
| --- | --- |
| `GET /reports/monthly?month=YYYY-MM` | Totals + category breakdown |
| `GET /reports/yearly?year=YYYY` | Monthly series + yearly totals |
| `GET /reports/category?month=YYYY-MM` | Category-wise expenses |
| `GET /reports/payment-method?month=YYYY-MM` | Spend by payment method |
| `GET /reports/goals` | Goal progress |

---

## Settings & Data 🔒

### `PUT /settings`
**Body (any subset):** `{ name?, currency?, language?, theme?, monthly_budget? }`

### `GET /settings/backup`
Full JSON export of the user's data.

### `POST /settings/restore`
Replace all data from a backup: `{ incomes[], expenses[], goals[], budgets[] }`.

### `POST /settings/import`
Bulk-append parsed rows: `{ incomes?: [...], expenses?: [...] }`.

### `DELETE /settings/data` → `204`
Delete all financial data for the user (account preserved).

---

## Health

### `GET /health`
`{ "status": "ok", "time": "…" }`
