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
} as const;

export const isProd = config.env === 'production';
