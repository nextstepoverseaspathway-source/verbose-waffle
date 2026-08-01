/**
 * SQLite database bootstrap.
 *
 * Uses better-sqlite3 (synchronous, fast, zero-config) for development.
 * The schema is applied idempotently on startup so the app works
 * out-of-the-box with no separate migration step.
 *
 * For production PostgreSQL, swap this module for a pg-backed adapter
 * that exposes the same query surface (see docs/DEPLOYMENT.md).
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { config } from '../config';

/**
 * Resolve a database file path we can actually write to.
 *
 * Hosting platforms (e.g. Render's free plan) may point SQLITE_PATH at a
 * directory that doesn't exist or isn't writable — for example a disk mount
 * that is only present on paid plans. Rather than crash on startup, we verify
 * the preferred location and transparently fall back to the OS temp directory
 * so the app always boots. (Temp storage is ephemeral; use a persistent disk
 * or PostgreSQL for durable data — see docs/DEPLOYMENT.md.)
 */
function resolveWritableDbPath(preferred: string): string {
  const fallback = path.join(os.tmpdir(), 'smart-savings.db');
  for (const candidate of [preferred, fallback]) {
    try {
      const dir = path.dirname(candidate);
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return candidate;
    } catch {
      // Try the next candidate.
    }
  }
  return fallback;
}

const dbPath = resolveWritableDbPath(config.sqlitePath);
if (dbPath !== config.sqlitePath) {
  // eslint-disable-next-line no-console
  console.warn(
    `[db] "${config.sqlitePath}" is not writable; falling back to "${dbPath}". ` +
      'Data here is not durable — attach a disk or use PostgreSQL for persistence.',
  );
}

// Ensure the uploads directory exists (best-effort; non-fatal if it fails).
try {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
} catch {
  // Receipt uploads will be unavailable, but the app still runs.
}

export const db = new Database(dbPath);

// Pragmas for better concurrency and integrity.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Apply the schema. Safe to call repeatedly (uses IF NOT EXISTS). */
export function initSchema(): void {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
}

initSchema();
