/**
 * User settings & data-management routes (all require auth).
 *
 *   PUT    /api/settings          — update profile/preferences
 *   GET    /api/settings/backup   — export all user data as JSON (backup)
 *   POST   /api/settings/restore  — restore from a JSON backup
 *   POST   /api/settings/import   — bulk import income/expense rows (from CSV parsed client-side)
 *   DELETE /api/settings/data     — delete all of the user's financial data
 */
import { Router } from 'express';
import { db } from '../db/database';
import { currentUserId, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { Expense, Income } from '../types';
import { settingsSchema } from '../utils/validation';

const router = Router();
router.use(requireAuth);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const body = settingsSchema.parse(req.body);
    const userId = currentUserId(res);
    const fields = Object.entries(body).filter(([, v]) => v !== undefined);
    if (fields.length) {
      const set = fields.map(([k]) => `${k} = @${k}`).join(', ');
      db.prepare(`UPDATE users SET ${set} WHERE id = @id`).run({ ...body, id: userId });
    }
    const user = db
      .prepare(
        'SELECT id, email, name, provider, currency, language, theme, monthly_budget, created_at FROM users WHERE id = ?',
      )
      .get(userId);
    res.json({ user });
  }),
);

router.get(
  '/backup',
  asyncHandler(async (_req, res) => {
    const userId = currentUserId(res);
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      incomes: db.prepare('SELECT * FROM incomes WHERE user_id = ?').all(userId),
      expenses: db.prepare('SELECT * FROM expenses WHERE user_id = ?').all(userId),
      goals: db.prepare('SELECT * FROM goals WHERE user_id = ?').all(userId),
      budgets: db.prepare('SELECT * FROM budgets WHERE user_id = ?').all(userId),
    };
    res.setHeader('Content-Disposition', 'attachment; filename="savings-backup.json"');
    res.json(backup);
  }),
);

/** Bulk import parsed rows. Used by both CSV/Excel import and restore. */
function importRows(userId: number, incomes: Partial<Income>[], expenses: Partial<Expense>[]) {
  const insertIncome = db.prepare(
    `INSERT INTO incomes (user_id, date, source, category, description, amount, payment_method, received_from, reference_number, recurring, notes)
     VALUES (@user_id, @date, @source, @category, @description, @amount, @payment_method, @received_from, @reference_number, @recurring, @notes)`,
  );
  const insertExpense = db.prepare(
    `INSERT INTO expenses (user_id, date, category, subcategory, description, amount, payment_method, vendor, tax, recurring, notes)
     VALUES (@user_id, @date, @category, @subcategory, @description, @amount, @payment_method, @vendor, @tax, @recurring, @notes)`,
  );

  const tx = db.transaction(() => {
    for (const r of incomes) {
      insertIncome.run({
        user_id: userId,
        date: r.date,
        source: r.source ?? 'Imported',
        category: r.category ?? 'Other',
        description: r.description ?? null,
        amount: Number(r.amount ?? 0),
        payment_method: r.payment_method ?? null,
        received_from: r.received_from ?? null,
        reference_number: r.reference_number ?? null,
        recurring: r.recurring ? 1 : 0,
        notes: r.notes ?? null,
      });
    }
    for (const r of expenses) {
      insertExpense.run({
        user_id: userId,
        date: r.date,
        category: r.category ?? 'Miscellaneous',
        subcategory: r.subcategory ?? null,
        description: r.description ?? null,
        amount: Number(r.amount ?? 0),
        payment_method: r.payment_method ?? null,
        vendor: r.vendor ?? null,
        tax: r.tax ?? null,
        recurring: r.recurring ? 1 : 0,
        notes: r.notes ?? null,
      });
    }
  });
  tx();
}

router.post(
  '/import',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const incomes = Array.isArray(req.body.incomes) ? req.body.incomes : [];
    const expenses = Array.isArray(req.body.expenses) ? req.body.expenses : [];
    importRows(userId, incomes, expenses);
    res.json({ imported: { incomes: incomes.length, expenses: expenses.length } });
  }),
);

router.post(
  '/restore',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const { incomes = [], expenses = [], goals = [], budgets = [] } = req.body;

    const tx = db.transaction(() => {
      db.prepare('DELETE FROM incomes WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM expenses WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM budgets WHERE user_id = ?').run(userId);
      importRows(userId, incomes, expenses);
      for (const g of goals) {
        db.prepare(
          `INSERT INTO goals (user_id, name, type, target_amount, current_amount, deadline, monthly_contribution)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          userId,
          g.name,
          g.type ?? 'Custom Goal',
          g.target_amount,
          g.current_amount ?? 0,
          g.deadline ?? null,
          g.monthly_contribution ?? 0,
        );
      }
      for (const b of budgets) {
        db.prepare(
          'INSERT INTO budgets (user_id, category, month, amount) VALUES (?, ?, ?, ?)',
        ).run(userId, b.category, b.month ?? null, b.amount);
      }
    });
    tx();
    res.json({ restored: true });
  }),
);

router.delete(
  '/data',
  asyncHandler(async (_req, res) => {
    const userId = currentUserId(res);
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM incomes WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM expenses WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM goals WHERE user_id = ?').run(userId);
      db.prepare('DELETE FROM budgets WHERE user_id = ?').run(userId);
    });
    tx();
    res.status(204).end();
  }),
);

export default router;
