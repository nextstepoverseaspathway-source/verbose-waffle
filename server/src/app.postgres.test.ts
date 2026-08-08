/**
 * Postgres-path integration tests.
 *
 * Runs the real Postgres adapter code against an in-memory Postgres (pg-mem),
 * validating that the dialect-neutral SQL, placeholder translation, RETURNING
 * inserts, and transactions all work on the pg backend — without needing a
 * live database. Complements app.test.ts, which exercises the SQLite path.
 */
import request from 'supertest';
import { beforeAll, describe, expect, it, vi } from 'vitest';

// Make the adapter select the Postgres backend.
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret';

// Back node-postgres with pg-mem so `import 'pg'` returns an in-memory Pool.
// pg-mem implements few native functions, so we register substr() (which real
// Postgres provides) to mirror production behaviour.
const { adapter } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { newDb, DataType } = require('pg-mem');
  const mem = newDb();
  mem.public.registerFunction({
    name: 'substr',
    args: [DataType.text, DataType.integer, DataType.integer],
    returns: DataType.text,
    implementation: (v: string, start: number, len: number) =>
      v == null ? null : String(v).substr(start - 1, len),
  });
  return { adapter: mem.adapters.createPg() };
});
vi.mock('pg', () => ({ default: adapter, Pool: adapter.Pool, Client: adapter.Client }));

const { createApp } = await import('./app');
const { initDb, db } = await import('./db/database');
const app = createApp();

const EMAIL = 'pg@example.com';
let token = '';

describe('Smart Savings Tracker API (Postgres backend)', () => {
  beforeAll(async () => {
    await initDb();
  });

  it('reports the postgres dialect', async () => {
    expect(db.dialect).toBe('postgres');
  });

  it('registers, verifies, and logs in (RETURNING insert + verification flow)', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ name: 'PG', email: EMAIL, password: 'secret1234' });
    expect(reg.status).toBe(201);
    expect(reg.body.requiresVerification).toBe(true);
    expect(reg.body.token).toBeUndefined();

    const row = (await db
      .prepare('SELECT verification_token FROM users WHERE email = ?')
      .get(EMAIL)) as { verification_token: string };
    expect(row.verification_token).toBeTruthy();

    const verify = await request(app).get(`/api/auth/verify?token=${row.verification_token}`);
    expect(verify.status).toBe(302);

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'secret1234' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    token = login.body.token;
  });

  it('creates income and expenses, then aggregates the dashboard', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const month = new Date().toISOString().slice(0, 10);

    await request(app)
      .post('/api/income')
      .set(auth)
      .send({ date: month, source: 'Salary', category: 'Salary', amount: 5000 })
      .expect(201);
    await request(app)
      .post('/api/expenses')
      .set(auth)
      .send({ date: month, category: 'Food', amount: 1200 })
      .expect(201);

    const dash = await request(app).get('/api/dashboard').set(auth);
    expect(dash.status).toBe(200);
    expect(dash.body.totalIncome).toBe(5000);
    expect(dash.body.totalExpenses).toBe(1200);
    expect(dash.body.totalSavings).toBe(3800);
  });

  it('upserts a budget (ON CONFLICT ... RETURNING)', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    const monthKey = new Date().toISOString().slice(0, 7);
    const first = await request(app)
      .put('/api/budgets')
      .set(auth)
      .send({ category: 'Food', month: monthKey, amount: 3000 });
    expect(first.status).toBe(200);

    // Upsert the same category → amount updated, not duplicated.
    const second = await request(app)
      .put('/api/budgets')
      .set(auth)
      .send({ category: 'Food', month: monthKey, amount: 3500 });
    expect(second.status).toBe(200);

    const list = await request(app).get(`/api/budgets?month=${monthKey}`).set(auth);
    const food = list.body.data.filter((b: { category: string }) => b.category === 'Food');
    expect(food).toHaveLength(1);
    expect(food[0].amount).toBe(3500);
  });

  it('deletes all data in a transaction', async () => {
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).delete('/api/settings/data').set(auth).expect(204);
    const list = await request(app).get('/api/income').set(auth);
    expect(list.body.data).toHaveLength(0);
  });
});
