/**
 * Report routes (all require auth). Each returns structured JSON that the
 * client renders as tables/charts and can export to CSV/PDF/Excel.
 *
 *   GET /api/reports/monthly?month=YYYY-MM
 *   GET /api/reports/yearly?year=YYYY
 *   GET /api/reports/category?month=YYYY-MM   (category-wise expense breakdown)
 *   GET /api/reports/payment-method?month=YYYY-MM
 *   GET /api/reports/goals
 */
import { Router } from 'express';
import { db } from '../db/database';
import { currentUserId, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import { expenseByCategory, monthlySeries } from '../utils/analytics';

const router = Router();
router.use(requireAuth);

const sum = (rows: { t: number | null }[]) => rows.reduce((s, r) => s + (r.t ?? 0), 0);

router.get(
  '/monthly',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const month = String(req.query.month ?? new Date().toISOString().slice(0, 7));

    const income = (await db
      .prepare("SELECT SUM(amount) AS t FROM incomes WHERE user_id = ? AND substr(date, 1, 7) = ?")
      .get(userId, month)) as { t: number | null } | undefined;
    const expense = (await db
      .prepare("SELECT SUM(amount) AS t FROM expenses WHERE user_id = ? AND substr(date, 1, 7) = ?")
      .get(userId, month)) as { t: number | null } | undefined;

    const totalIncome = Number(income?.t ?? 0) || 0;
    const totalExpenses = Number(expense?.t ?? 0) || 0;
    res.json({
      type: 'monthly',
      month,
      totalIncome,
      totalExpenses,
      savings: totalIncome - totalExpenses,
      categories: await expenseByCategory(userId, month),
    });
  }),
);

router.get(
  '/yearly',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const year = String(req.query.year ?? new Date().getFullYear());
    const series = await monthlySeries(userId, year);
    res.json({
      type: 'yearly',
      year,
      series,
      totalIncome: series.reduce((s, p) => s + p.income, 0),
      totalExpenses: series.reduce((s, p) => s + p.expense, 0),
      totalSavings: series.reduce((s, p) => s + p.savings, 0),
    });
  }),
);

router.get(
  '/category',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const month = String(req.query.month ?? new Date().toISOString().slice(0, 7));
    res.json({ type: 'category', month, categories: await expenseByCategory(userId, month) });
  }),
);

router.get(
  '/payment-method',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const month = String(req.query.month ?? new Date().toISOString().slice(0, 7));
    const rows = await db
      .prepare(
        `SELECT COALESCE(payment_method, 'Unspecified') AS method, SUM(amount) AS total
         FROM expenses WHERE user_id = ? AND substr(date, 1, 7) = ?
         GROUP BY COALESCE(payment_method, 'Unspecified') ORDER BY total DESC`,
      )
      .all(userId, month);
    res.json({
      type: 'payment-method',
      month,
      methods: rows.map((r) => ({ method: String(r.method), total: Number(r.total) || 0 })),
    });
  }),
);

router.get(
  '/goals',
  asyncHandler(async (_req, res) => {
    const rows = (await db
      .prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC')
      .all(currentUserId(res))) as {
      target_amount: number;
      current_amount: number;
    }[];
    const data = rows.map((g) => ({
      ...g,
      progress:
        g.target_amount > 0
          ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100))
          : 0,
    }));
    res.json({ type: 'goals', goals: data });
  }),
);

export default router;
