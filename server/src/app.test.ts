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
const app = createApp();

let token = '';

describe('Smart Savings Tracker API', () => {
  beforeAll(() => {
    /* app + schema created on import */
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

  it('registers a new user and returns a token', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test', email: 'test@example.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    token = res.body.token;
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
