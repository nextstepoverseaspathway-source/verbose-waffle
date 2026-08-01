# 💰 Smart Savings Tracker

A modern, responsive **Personal Monthly Savings Tracker**. Record income and
expenses, plan budgets, set savings goals, generate reports, and get
personalized financial insights — all in a clean, premium interface with full
dark mode and mobile support.

<p align="center">
  <em>React + TypeScript · Node.js + Express · SQLite/PostgreSQL · Recharts</em>
</p>

---

## ✨ Features

| Area | Highlights |
| --- | --- |
| **Dashboard** | Income, expenses, savings, savings %, monthly budget, remaining budget, highest-expense category, financial health score, savings & goal progress, upcoming bills, recent transactions, quick add. |
| **Income** | Unlimited entries; source, category, description, amount, payment method, received-from, reference number, recurring flag, notes. 13 income categories. |
| **Expenses** | Unlimited entries; category + subcategory, vendor, GST/tax, receipt upload, recurring flag, notes. 15 category groups covering 60+ expense types. |
| **Savings** | Auto-computed monthly, yearly, average savings, savings %, best & worst months. |
| **Goals** | Emergency fund, vacation, car, home, education, wedding, investment, custom — with progress %, deadline, monthly contribution, and ETA. |
| **Budgets** | Per-category monthly limits with spent / remaining / % used, and over-budget warnings. |
| **Reports** | Monthly, yearly, category-wise, payment-method, and goal-progress reports. |
| **Charts** | Income vs expense vs savings bars, expense pie, savings-trend area, yearly line, category & payment-method breakdowns (Recharts). |
| **Filters & Search** | Date range, month, year, category, payment method, amount range, and free-text search. |
| **Export / Import** | Export to **PDF**, **Excel**, **CSV**; import transactions from **CSV**; JSON backup / restore. |
| **Notifications** | Budget-limit, low-savings, and goal-achievement toasts. |
| **AI Insights** | Heuristic monthly insights — spending changes, top categories, suggested saving target, savings rate. |
| **Settings** | Currency, language, dark/light/system theme, monthly budget, backup, restore, export, delete data, profile. |
| **Auth** | Secure email/password (JWT + bcrypt), Google sign-in (Firebase-ready), forgot-password flow. |

---

## 🏗️ Tech Stack & Architecture

```
smart-savings-tracker/
├── server/                 # Node.js + Express + TypeScript REST API
│   ├── src/
│   │   ├── db/             # SQLite bootstrap, schema.sql, seed script
│   │   ├── middleware/     # auth (JWT), error handling
│   │   ├── routes/         # auth, income, expenses, goals, budgets,
│   │   │                   #   dashboard, reports, settings, meta
│   │   ├── utils/          # constants, validation (zod), filters, analytics
│   │   ├── app.ts          # Express app factory
│   │   └── index.ts        # HTTP entry point
│   └── app.test.ts         # Vitest + Supertest integration tests
├── client/                 # React + TypeScript + Vite SPA
│   └── src/
│       ├── api/            # typed fetch client
│       ├── components/     # Layout, UI primitives, forms, icons
│       ├── context/        # Auth, Theme, Toast, Meta providers
│       ├── pages/          # Login, Dashboard, Income, Expenses, Goals,
│       │                   #   Budgets, Reports, Settings
│       └── utils/          # formatting, exporters, colors
└── docs/                   # API, DATABASE, DEPLOYMENT, TESTING guides
```

Design principles: **component-based architecture**, **SOLID**, reusable
components, centralized validation and error handling, and a normalized (3NF)
schema. See [`docs/`](./docs) for details.

---

## 🚀 Quick Start

Requires **Node.js ≥ 18**.

```bash
# 1. Install all dependencies (root, server, client via npm workspaces)
npm install

# 2. Configure the server environment
cp server/.env.example server/.env
#   (edit JWT_SECRET for anything beyond local dev)

# 3. Seed a demo account with 6 months of sample data
npm run seed

# 4. Run backend + frontend together (http://localhost:5173)
npm run dev
```

Then open **http://localhost:5173** and sign in with the demo account:

```
Email:    demo@savings.app
Password: demo1234
```

> Prefer separate terminals? Use `npm run dev:server` and `npm run dev:client`.

### Build for production

```bash
npm run build          # builds server (dist/) and client (client/dist/)
npm start              # starts the API server (serve client/dist via any static host)
```

---

## 📚 Documentation

- [API Reference](./docs/API.md) — every endpoint, params, and examples
- [Database Schema](./docs/DATABASE.md) — tables, relationships, PostgreSQL notes
- [Deployment Guide](./docs/DEPLOYMENT.md) — production, PostgreSQL, Firebase
- [Testing Guide](./docs/TESTING.md) — how to run and extend tests
- [Sample Data](./docs/sample-data) — CSV files for import testing

---

## 🧪 Testing

```bash
npm test               # runs the server integration test suite (Vitest)
```

---

## 🔐 Security Notes

- Passwords hashed with **bcrypt**; sessions are stateless **JWTs**.
- All financial data is **scoped per user** at the query level.
- Inputs validated with **zod**; SQL uses **parameterized** statements.
- For production, set a strong `JWT_SECRET` and serve over HTTPS.

---

## 📄 License

MIT — free to use and adapt.
