# Deployment Guide

This guide covers running Smart Savings Tracker in production with PostgreSQL,
Firebase authentication, and a static-hosted frontend.

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

## 5. PostgreSQL

1. Provision a PostgreSQL database and set `DATABASE_URL`.
2. Adapt `server/src/db/database.ts` to a `pg` pool (or an ORM). The route
   layer uses parameterized SQL and does not need changes — only the thin
   adapter that exposes `prepare().run/get/all`.
3. Apply the schema from `server/src/db/schema.sql` with the type mappings in
   [DATABASE.md](./DATABASE.md).

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
