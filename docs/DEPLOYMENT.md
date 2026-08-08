# Deployment Guide

This guide covers running Smart Savings Tracker in production with PostgreSQL,
Firebase authentication, and a static-hosted frontend.

## 0. One-click deploy on Render (get a URL fast)

The repo includes a [`render.yaml`](../render.yaml) blueprint. In production the
Express API also serves the built React SPA, so the whole app runs as a
**single web service on one URL** — no separate frontend host, no CORS setup.

1. Push the repo to GitHub.
2. Go to <https://dashboard.render.com> → **New → Blueprint**.
3. Connect this repository and select the branch.
4. Click **Apply**. Render runs `npm install && npm run build`, then
   `npm start`, and gives you a URL like `https://smart-savings-tracker.onrender.com`.
5. Open the URL and **register an account** (a fresh deploy has no demo data;
   run `npm run seed` locally if you want the sample dataset).

Free-plan notes: the service spins down after ~15 min idle and cold-starts on
the next request; the SQLite file is on ephemeral storage and resets on
redeploy. For durable data, switch to a paid plan and uncomment the `disk`
block in `render.yaml` (SQLite then lives on a mounted volume), or move to
PostgreSQL (section 5).

The same single-service model deploys just as easily to Railway, Fly.io, or any
Node host: build with `npm run build`, start with `npm start`, health-check
`/api/health`.

## 0b. One-click deploy on Railway

The repo also includes [`railway.json`](../railway.json), which tells Railway to
build with `npm install && npm run build`, start with `npm start`, and
health-check `/api/health`.

1. Go to <https://railway.app> → **New Project → Deploy from GitHub repo**.
2. Select this repository (and branch).
3. In the service's **Variables** tab, set:
   - `JWT_SECRET` — a long random string (**required**; generate with
     `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`).
   - `NODE_ENV` = `production` (recommended).
   - *(optional)* `SQLITE_PATH` = `/data/savings.db` if you attach a volume.
4. Deploy. Railway assigns a public domain (enable one under **Settings →
   Networking → Generate Domain** if not automatic) — that's your URL.

Railway injects `PORT` automatically and the server honors it. For durable
data, add a **Volume** mounted at e.g. `/data` and point `SQLITE_PATH` at it;
otherwise the SQLite file resets on redeploy (see section 5 for PostgreSQL).

## 1. Environment Variables (server)

Create `server/.env` (see `server/.env.example`):

```ini
PORT=4000
NODE_ENV=production
CLIENT_ORIGIN=https://your-frontend-domain.com
JWT_SECRET=<a long random string>       # REQUIRED in production
JWT_EXPIRES_IN=7d
DATABASE_URL=postgres://user:pass@host:5432/savings   # enables PostgreSQL
# FIREBASE_PROJECT_ID=your-firebase-project            # enables token verification
```

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 2. Build

```bash
npm install
npm run build          # compiles server → server/dist, client → client/dist
```

## 3. Run the API

```bash
npm start              # node server/dist/index.js
```

Run behind a process manager (pm2, systemd) and a reverse proxy (nginx,
Caddy) terminating TLS. Example pm2:

```bash
pm2 start server/dist/index.js --name savings-api
```

## 4. Serve the Frontend

The client is a static SPA. Deploy `client/dist` to any static host (Netlify,
Vercel, S3+CloudFront, nginx). Configure the host to:

1. Serve `index.html` for unknown routes (SPA fallback).
2. Proxy `/api` and `/uploads` to the API server, **or** set an absolute API
   base URL. To use an absolute base, change the `fetch` prefix in
   `client/src/api/client.ts` from `/api` to `import.meta.env.VITE_API_URL`.

Example nginx:

```nginx
location / {
  root /var/www/savings/client/dist;
  try_files $uri /index.html;
}
location /api/     { proxy_pass http://127.0.0.1:4000; }
location /uploads/ { proxy_pass http://127.0.0.1:4000; }
```

## 5. PostgreSQL (durable data — recommended for production)

PostgreSQL support is **built in**. The database adapter
(`server/src/db/database.ts`) uses SQLite by default and switches to Postgres
automatically when `DATABASE_URL` is set — no code changes needed. The schema
is created on startup from `server/src/db/schema.postgres.sql`, and queries are
written in a dialect-neutral subset so they run on both backends.

### Quick setup with a free Neon database

1. Create a free project at <https://neon.tech> (the free tier is durable and
   does not expire).
2. Copy the **connection string** it gives you, e.g.
   `postgres://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require`.
3. Set it as `DATABASE_URL` on your host:
   - **Render:** open the service → **Environment** → add `DATABASE_URL` →
     paste the string → **Save** (the service redeploys automatically).
   - **Railway/other:** add `DATABASE_URL` in the service's variables.
4. On the next deploy the app creates its tables in Postgres and stores all
   data there. Restarts and redeploys no longer lose data.

> The same works with any managed Postgres (Render Postgres, Supabase, RDS,
> etc.) — only the connection string differs. TLS is enabled by default in the
> adapter, which managed providers require.

Prefer keeping SQLite but making it durable instead? Attach a persistent disk
(paid) and point `SQLITE_PATH` at the mount — see the commented block in
[`render.yaml`](../render.yaml).

## 5b. Email verification (Resend)

New **email** accounts must verify their address before they can log in
(Google accounts are trusted and auto-verified). Verification emails are sent
via [Resend](https://resend.com).

1. Create a Resend account and an **API key**.
2. Verify a sending domain in Resend (for quick testing you can use their
   shared `onboarding@resend.dev` sender, which only delivers to the account
   owner's address).
3. Set these environment variables on your host:
   - `RESEND_API_KEY` — your Resend API key (**required to send real emails**).
   - `RESEND_FROM` — e.g. `Smart Savings Tracker <no-reply@yourdomain.com>`.
   - `APP_URL` — your public URL (e.g. `https://your-app.onrender.com`), used
     to build the verification link.

Flow: `POST /auth/register` creates the account and emails a link to
`GET /auth/verify?token=…`; clicking it marks the account verified and
redirects to `/login?verified=1`. `POST /auth/login` returns `403` until then.

> If `RESEND_API_KEY` is not set, the app still works but instead of sending an
> email it **logs the verification link to the server console** — open the logs,
> copy the link, and visit it to verify. Good for local development; set a real
> key in production.

## 6. Firebase Authentication (Google & Email)

The app ships with a provider-agnostic auth API. To use **Firebase**:

1. Create a Firebase project and enable **Email/Password** and **Google**
   providers.
2. In the client, initialize Firebase and perform sign-in with the Firebase
   SDK. On success you receive an **ID token** and the user's profile.
3. Send the ID token to your backend. Verify it with the Firebase Admin SDK
   (using `FIREBASE_PROJECT_ID`), then call the existing `/auth/google`
   upsert logic with the verified email/name and issue your app JWT.
4. **Forgot password** is handled by Firebase's
   `sendPasswordResetEmail` — no backend endpoint required.

> The current `/auth/google` endpoint accepts a resolved profile so the app is
> fully functional without Firebase during development. Add token verification
> before exposing it publicly.

## 7. Receipts & Uploads

Uploaded receipts are stored under `server/uploads/`. For production, mount a
persistent volume or switch multer's storage to an object store (S3, GCS) and
serve via signed URLs.

## 8. Health Checks

Point your platform's health check at `GET /api/health`.

## 9. Backups

Users can export a JSON backup from **Settings → Download Backup**. For
server-side backups, snapshot the SQLite file or use your PostgreSQL
provider's automated backups.
