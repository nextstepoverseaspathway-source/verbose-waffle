/**
 * Dashboard + analytics routes (all require auth).
 *
 *   GET /api/dashboard          — home dashboard summary for the current month
 *   GET /api/dashboard/savings  — savings statistics
 *   GET /api/dashboard/insights — heuristic financial insights ("AI")
 *   GET /api/dashboard/charts   — series data for charts (?year=YYYY)
 */
import { Router } from 'express';
import { db } from '../db/database';
import { currentUserId, requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';
import {
  expenseByCategory,
  financialHealthScore,
  generateInsights,
  monthlySeries,
  savingsStats,
} from '../utils/analytics';

const router = Router();
router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const userId = currentUserId(res);
    const month = new Date().toISOString().slice(0, 7);

    const num = (v: unknown): number => (v == null ? 0 : Number(v)) || 0;

    const incomeRow = await db
      .prepare("SELECT SUM(amount) AS t FROM incomes WHERE user_id = ? AND substr(date, 1, 7) = ?")
      .get(userId, month);
    const totalIncome = num(incomeRow?.t);
    const expenseRow = await db
      .prepare("SELECT SUM(amount) AS t FROM expenses WHERE user_id = ? AND substr(date, 1, 7) = ?")
      .get(userId, month);
    const totalExpenses = num(expenseRow?.t);

    const user = (await db
      .prepare('SELECT monthly_budget, currency FROM users WHERE id = ?')
      .get(userId)) as { monthly_budget: number; currency: string };
    const monthlyBudget = num(user.monthly_budget);

    const totalSavings = totalIncome - totalExpenses;
    const categories = await expenseByCategory(userId, month);
    const goals = (await db.prepare('SELECT * FROM goals WHERE user_id = ?').all(userId)) as {
      target_amount: number;
      current_amount: number;
    }[];
    const goalTarget = goals.reduce((s, g) => s + num(g.target_amount), 0);
    const goalSaved = goals.reduce((s, g) => s + num(g.current_amount), 0);

    // Recurring expenses act as a proxy for upcoming bills.
    const upcomingBills = await db
      .prepare(
        `SELECT id, category, subcategory, amount, date FROM expenses
         WHERE user_id = ? AND recurring = 1 ORDER BY date DESC LIMIT 5`,
      )
      .all(userId);

    const recentTransactions = await db
      .prepare(
        `SELECT id, 'income' AS kind, date, category, source AS label, amount FROM incomes WHERE user_id = ?
         UNION ALL
         SELECT id, 'expense' AS kind, date, category, COALESCE(vendor, category) AS label, amount FROM expenses WHERE user_id = ?
         ORDER BY date DESC LIMIT 8`,
      )
      .all(userId, userId);

    res.json({
      month,
      currency: user.currency,
      totalIncome,
      totalExpenses,
      totalSavings,
      savingsRate: totalIncome > 0 ? Math.round((totalSavings / totalIncome) * 100) : 0,
      monthlyBudget,
      remainingBudget: monthlyBudget - totalExpenses,
      budgetUsedPercent:
        monthlyBudget > 0 ? Math.round((totalExpenses / monthlyBudget) * 100) : 0,
      highestExpenseCategory: categories[0] ?? null,
      goalProgress: { saved: goalSaved, target: goalTarget },
      healthScore: await financialHealthScore(userId),
      upcomingBills,
      recentTransactions,
    });
  }),
);

router.get(
  '/savings',
  asyncHandler(async (_req, res) => {
    res.json(await savingsStats(currentUserId(res)));
  }),
);

router.get(
  '/insights',
  asyncHandler(async (_req, res) => {
    res.json({ insights: await generateInsights(currentUserId(res)) });
  }),
);

router.get(
  '/charts',
  asyncHandler(async (req, res) => {
    const userId = currentUserId(res);
    const year = req.query.year ? String(req.query.year) : undefined;
    const month = new Date().toISOString().slice(0, 7);
    res.json({
      series: await monthlySeries(userId, year),
      expensePie: await expenseByCategory(userId, month),
    });
  }),
);

export default router;
