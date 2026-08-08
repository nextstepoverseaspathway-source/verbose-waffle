/**
 * Central application configuration.
 * Reads from environment variables with sensible development defaults.
 */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),

  /** Origins allowed to call the API (CORS). */
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),

  jwtSecret: process.env.JWT_SECRET ?? 'dev-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',

  /** Absolute path to the SQLite database file (development). */
  sqlitePath:
    process.env.SQLITE_PATH ??
    path.join(__dirname, '..', 'data', 'savings.db'),

  /** Optional Postgres URL for production (documented, not required for dev). */
  databaseUrl: process.env.DATABASE_URL,

  /** Directory where uploaded receipts are stored. */
  uploadsDir: path.join(__dirname, '..', 'uploads'),

  /**
   * Built client assets. In production the API server also serves the SPA
   * from here, so the whole app runs on a single origin/URL.
   * Resolves to <repo>/client/dist relative to the compiled server (dist/).
   */
  clientDist: path.join(__dirname, '..', '..', 'client', 'dist'),

  /** Public base URL of the app, used to build email verification links. */
  appUrl: process.env.APP_URL ?? process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',

  /** Resend transactional email. When RESEND_API_KEY is unset, emails are
   *  logged to the console instead of sent (handy for local development). */
  resendApiKey: process.env.RESEND_API_KEY,
  resendFrom: process.env.RESEND_FROM ?? 'Smart Savings Tracker <onboarding@resend.dev>',
} as const;

export const isProd = config.env === 'production';
