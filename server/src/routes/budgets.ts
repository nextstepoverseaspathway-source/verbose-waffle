/**
 * Budget planner routes (all require auth).
 *
 *   GET  /api/budgets?month=YYYY-MM  — budgets with spent/remaining for the month
 *   PUT  /api/budgets                — upsert a category budget
 *   DELETE /api/budgets/:id          — remove a budget
 */
import { Router } from 'express';
import { db } from '../db/database';
import { currentUserId, requireAuth } from '../middleware/auth';
import { ApiError, asyncHandler } from '../middleware/errorHandler';
import { Budget } from '../types';
import { budgetSchema } from '../utils/validation';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const month = String(req.query.month ?? new Date().toISOString().slice(0, 7)); // YYYY-MM

    // A budget applies to a month if it is explicitly for that month or is a
    // default (month IS NULL). Explicit month wins when both exist.
    const budgets = db
      .prepare(
        `SELECT * FROM budgets
         WHERE user_id = ? AND (month = ? OR month IS NULL)
         ORDER BY category`,
      )
      .all(userId, month) as Budget[];

    // Collapse to one row per category (prefer explicit month).
    const byCategory = new Map<string, Budget>();
    for (const b of budgets) {
      const existing = byCategory.get(b.category);
      if (!existing || b.month === month) byCategory.set(b.category, b);
    }

    // Spent per category for the month.
    const spentRows = db
      .prepare(
        `SELECT category, SUM(amount) AS spent
         FROM expenses
         WHERE user_id = ? AND strftime('%Y-%m', date) = ?
         GROUP BY category`,
      )
      .all(userId, month) as { category: string; spent: number }[];
    const spentMap = new Map(spentRows.map((r) => [r.category, r.spent]));

    const data = [...byCategory.values()].map((b) => {
      const spent = spentMap.get(b.category) ?? 0;
      return {
        ...b,
        spent,
        remaining: b.amount - spent,
        percentUsed: b.amount > 0 ? Math.round((spent / b.amount) * 100) : 0,
      };
    });

    res.json({ data, month });
  }),
);

router.put(
  '/',
  asyncHandler(async (req, res) => {
    const body = budgetSchema.parse(req.body);
    const userId = currentUserId(res);
    // Upsert on (user, category, month).
    db.prepare(
      `INSERT INTO budgets (user_id, category, month, amount)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(user_id, category, month) DO UPDATE SET amount = excluded.amount`,
    ).run(userId, body.category, body.month ?? null, body.amount);

    const row = db
      .prepare(
        'SELECT * FROM budgets WHERE user_id = ? AND category = ? AND month IS ?',
      )
      .get(userId, body.category, body.month ?? null);
    res.json({ data: row });
  }),
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const result = db
      .prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?')
      .run(req.params.id, currentUserId(res));
    if (result.changes === 0) throw new ApiError(404, 'Budget not found');
    res.status(204).end();
  }),
);

export default router;
