/**
 * Database adapter supporting two backends behind one small async API:
 *
 *   - SQLite  (better-sqlite3) for local development — zero config.
 *   - Postgres (pg)            for production — durable, set via DATABASE_URL.
 *
 * The rest of the app talks to `db.prepare(sql).get/all/run(...)`, `db.exec()`
 * and `db.tx()` without caring which backend is active. Queries are written in
 * a dialect-neutral subset (see docs/DATABASE.md); the only translation done
 * here is turning `?` / `@named` placeholders into Postgres `$1, $2, …`.
 */
import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { Pool } from 'pg';
import { config } from '../config';

export type Row = Record<string, any>;
export interface RunResult {
  changes: number;
  lastInsertRowid: number | bigint | null;
}

/** A prepared statement with async accessors (mirrors better-sqlite3's shape). */
export interface Statement {
  get(...params: any[]): Promise<Row | undefined>;
  all(...params: any[]): Promise<Row[]>;
  run(...params: any[]): Promise<RunResult>;
}

/** Minimal executor surface, available both on the db and inside a tx. */
export interface Executor {
  prepare(sql: string): Statement;
}

export interface Db extends Executor {
  readonly dialect: 'sqlite' | 'postgres';
  exec(sql: string): Promise<void>;
  tx<T>(fn: (t: Executor) => Promise<T>): Promise<T>;
  init(): Promise<void>;
}

/** True when a Postgres connection string is configured. */
const usePostgres = Boolean(config.databaseUrl);

/**
 * Normalize the variadic arguments used at call sites into either a positional
 * array (for `?` placeholders) or a single named object (for `@name`).
 */
function normalizeParams(params: any[]): { named?: Row; positional?: any[] } {
  if (
    params.length === 1 &&
    params[0] !== null &&
    typeof params[0] === 'object' &&
    !Array.isArray(params[0])
  ) {
    return { named: params[0] as Row };
  }
  return { positional: params };
}

/** Translate a dialect-neutral SQL string + params into Postgres form. */
function toPostgres(sql: string, params: any[]): { text: string; values: any[] } {
  const { named, positional } = normalizeParams(params);
  if (named) {
    const values: any[] = [];
    const text = sql.replace(/[@:](\w+)/g, (_m, name: string) => {
      values.push(named[name]);
      return `$${values.length}`;
    });
    return { text, values };
  }
  let i = 0;
  const text = sql.replace(/\?/g, () => `$${++i}`);
  return { text, values: positional ?? [] };
}

// ---------------------------------------------------------------------------
// SQLite backend
// ---------------------------------------------------------------------------
function createSqliteDb(): Db {
  const dbPath = resolveWritableDbPath(config.sqlitePath);
  if (dbPath !== config.sqlitePath) {
    // eslint-disable-next-line no-console
    console.warn(
      `[db] "${config.sqlitePath}" is not writable; falling back to "${dbPath}". ` +
        'Data here is not durable — use PostgreSQL (DATABASE_URL) for persistence.',
    );
  }
  const sqlite = new BetterSqlite3(dbPath);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');

  const makeStatement = (sql: string): Statement => {
    const stmt = sqlite.prepare(sql);
    // better-sqlite3 accepts positional args or a single named object directly.
    return {
      async get(...params: any[]) {
        return stmt.get(...params) as Row | undefined;
      },
      async all(...params: any[]) {
        return stmt.all(...params) as Row[];
      },
      async run(...params: any[]) {
        const info = stmt.run(...params);
        return { changes: info.changes, lastInsertRowid: info.lastInsertRowid };
      },
    };
  };

  return {
    dialect: 'sqlite',
    prepare: makeStatement,
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    async tx<T>(fn: (t: Executor) => Promise<T>): Promise<T> {
      sqlite.exec('BEGIN');
      try {
        const result = await fn({ prepare: makeStatement });
        sqlite.exec('COMMIT');
        return result;
      } catch (err) {
        sqlite.exec('ROLLBACK');
        throw err;
      }
    },
    async init() {
      const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
      sqlite.exec(schema);
    },
  };
}

/** Pick a writable SQLite path, falling back to the OS temp dir if needed. */
function resolveWritableDbPath(preferred: string): string {
  const fallback = path.join(os.tmpdir(), 'smart-savings.db');
  for (const candidate of [preferred, fallback]) {
    try {
      const dir = path.dirname(candidate);
      fs.mkdirSync(dir, { recursive: true });
      fs.accessSync(dir, fs.constants.W_OK);
      return candidate;
    } catch {
      // try next
    }
  }
  return fallback;
}

// ---------------------------------------------------------------------------
// Postgres backend
// ---------------------------------------------------------------------------
function createPostgresDb(): Db {
  const pool = new Pool({
    connectionString: config.databaseUrl,
    // Managed Postgres (Neon, Render, etc.) requires TLS.
    ssl: { rejectUnauthorized: false },
  });

  const runOn = async (
    query: (text: string, values: any[]) => Promise<{ rows: Row[]; rowCount: number | null }>,
    sql: string,
    params: any[],
  ) => {
    const { text, values } = toPostgres(sql, params);
    return query(text, values);
  };

  const statementFor = (
    query: (text: string, values: any[]) => Promise<{ rows: Row[]; rowCount: number | null }>,
  ) => (sql: string): Statement => ({
    async get(...params: any[]) {
      const res = await runOn(query, sql, params);
      return res.rows[0];
    },
    async all(...params: any[]) {
      const res = await runOn(query, sql, params);
      return res.rows;
    },
    async run(...params: any[]) {
      const res = await runOn(query, sql, params);
      return { changes: res.rowCount ?? 0, lastInsertRowid: null };
    },
  });

  const poolQuery = (text: string, values: any[]) => pool.query(text, values);

  return {
    dialect: 'postgres',
    prepare: statementFor(poolQuery),
    async exec(sql: string) {
      await pool.query(sql);
    },
    async tx<T>(fn: (t: Executor) => Promise<T>): Promise<T> {
      const client = await pool.connect();
      const clientQuery = (text: string, values: any[]) => client.query(text, values);
      try {
        await client.query('BEGIN');
        const result = await fn({ prepare: statementFor(clientQuery) });
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async init() {
      const schema = fs.readFileSync(path.join(__dirname, 'schema.postgres.sql'), 'utf-8');
      // Run each DDL statement separately (portable across Postgres drivers).
      const statements = schema
        .split(';')
        .map((s) => s.replace(/--.*$/gm, '').trim())
        .filter(Boolean);
      for (const stmt of statements) {
        await pool.query(stmt);
      }
    },
  };
}

export const db: Db = usePostgres ? createPostgresDb() : createSqliteDb();

/** Initialize the schema. Must be awaited before serving requests. */
export async function initDb(): Promise<void> {
  await db.init();
}
