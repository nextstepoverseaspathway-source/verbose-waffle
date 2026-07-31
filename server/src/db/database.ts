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
import path from 'path';
import { config } from '../config';

// Ensure the data + uploads directories exist.
fs.mkdirSync(path.dirname(config.sqlitePath), { recursive: true });
fs.mkdirSync(config.uploadsDir, { recursive: true });

export const db = new Database(config.sqlitePath);

// Pragmas for better concurrency and integrity.
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/** Apply the schema. Safe to call repeatedly (uses IF NOT EXISTS). */
export function initSchema(): void {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  db.exec(schema);
}

initSchema();
