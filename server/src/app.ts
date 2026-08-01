/**
 * Express application factory. Kept separate from `index.ts` so tests can
 * import the configured app without starting an HTTP listener.
 */
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import budgetRoutes from './routes/budgets';
import dashboardRoutes from './routes/dashboard';
import expenseRoutes from './routes/expenses';
import goalRoutes from './routes/goals';
import incomeRoutes from './routes/income';
import metaRoutes from './routes/meta';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: config.clientOrigins.length ? config.clientOrigins : true,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '10mb' }));

  // Serve uploaded receipts statically.
  app.use('/uploads', express.static(config.uploadsDir));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.use('/api/auth', authRoutes);
  app.use('/api/meta', metaRoutes);
  app.use('/api/income', incomeRoutes);
  app.use('/api/expenses', expenseRoutes);
  app.use('/api/goals', goalRoutes);
  app.use('/api/budgets', budgetRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/settings', settingsRoutes);

  // 404 for unknown API routes (kept before the SPA fallback so unmatched
  // API paths return JSON, not the HTML shell).
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // In production, serve the built React app from the same origin so the
  // entire product is reachable at a single URL. Any non-API route falls
  // back to index.html for client-side routing.
  if (fs.existsSync(config.clientDist)) {
    app.use(express.static(config.clientDist));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(config.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
