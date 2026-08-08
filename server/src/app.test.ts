/**
 * Integration tests for the core API flows using a throwaway SQLite file.
 * Run with: npm test
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// Point the DB at a temp file BEFORE importing the app (config reads env once).
const tmpDb = path.join(os.tmpdir(), `sst-test-${Date.now()}.db`);
process.env.SQLITE_PATH = tmpDb;
process.env.JWT_SECRET = 'test-secret';

// Dynamic import so the env vars above take effect.
const { createApp } = await import('./app');
const { initDb, db } = await import('./db/database');
const app = createApp();

const EMAIL = 'test@example.com';
let token = '';

describe('Smart Savings Tracker API', () => {
  beforeAll(async () => {
    await initDb(); // create the schema before requests
  });

  afterAll(() => {
    try {
      fs.unlinkSync(tmpDb);
    } catch {
      /* ignore */
    }
  });

  it('health check responds', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('rejects weak and short passwords on register', async () => {
    const short = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'x@example.com', password: 'short1' });
    expect(short.status).toBe(422);

    const weak = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'x@example.com', password: 'demo1234' });
    expect(weak.status).toBe(422);
  });

  it('registers a new user but does not issue a token (verification required)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: EMAIL, password: 'secret1234' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeUndefined();
    expect(res.body.requiresVerification).toBe(true);
  });

  it('blocks login until the email is verified', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'secret1234' });
    expect(res.status).toBe(403);
  });

  it('verifies the email via the token, then logs in successfully', async () => {
    const row = (await db
      .prepare('SELECT verification_token FROM users WHERE email = ?')
      .get(EMAIL)) as { verification_token: string };
    expect(row.verification_token).toBeTruthy();

    const verify = await request(app).get(`/api/auth/verify?token=${row.verification_token}`);
    expect(verify.status).toBe(302); // redirects back to the SPA

    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: EMAIL, password: 'secret1234' });
    expect(login.status).toBe(200);
    expect(login.body.token).toBeTruthy();
    token = login.body.token;
  });

  it('rejects unauthenticated income access', async () => {
    const res = await request(app).get('/api/income');
    expect(res.status).toBe(401);
  });

  it('creates and lists income', async () => {
    const create = await request(app)
      .post('/api/income')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-01', source: 'Salary', category: 'Salary', amount: 5000 });
    expect(create.status).toBe(201);

    const list = await request(app).get('/api/income').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].amount).toBe(5000);
  });

  it('validates expense input', async () => {
    const res = await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: 'not-a-date', category: 'Food', amount: -5 });
    expect(res.status).toBe(422);
  });

  it('computes the dashboard summary', async () => {
    await request(app)
      .post('/api/expenses')
      .set('Authorization', `Bearer ${token}`)
      .send({ date: '2026-07-05', category: 'Food', amount: 1200 });

    const res = await request(app).get('/api/dashboard').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalIncome');
    expect(res.body).toHaveProperty('totalSavings');
    expect(res.body).toHaveProperty('healthScore');
  });
});
