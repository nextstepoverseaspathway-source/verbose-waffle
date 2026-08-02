/**
 * Analytics helpers: monthly aggregation, savings statistics, and the
 * heuristic "AI" insight generator. All read from the database via the async
 * adapter and are written in dialect-neutral SQL (substr instead of strftime),
 * so they run identically on SQLite and Postgres.
 */
import { db } from '../db/database';

export interface MonthlyPoint {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  savings: number;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v)) || 0;

/** Aggregate income and expenses by month for a user (optionally a year). */
export async function monthlySeries(userId: number, year?: string): Promise<MonthlyPoint[]> {
  const yearClause = year ? 'AND substr(date, 1, 4) = ?' : '';
  const params = year ? [userId, year] : [userId];

  const income = await db
    .prepare(
      `SELECT substr(date, 1, 7) AS month, SUM(amount) AS total
       FROM incomes WHERE user_id = ? ${yearClause} GROUP BY substr(date, 1, 7)`,
    )
    .all(...params);
  const expense = await db
    .prepare(
      `SELECT substr(date, 1, 7) AS month, SUM(amount) AS total
       FROM expenses WHERE user_id = ? ${yearClause} GROUP BY substr(date, 1, 7)`,
    )
    .all(...params);

  const map = new Map<string, MonthlyPoint>();
  const ensure = (m: string) =>
    map.get(m) ?? map.set(m, { month: m, income: 0, expense: 0, savings: 0 }).get(m)!;
  income.forEach((r) => (ensure(String(r.month)).income = num(r.total)));
  expense.forEach((r) => (ensure(String(r.month)).expense = num(r.total)));
  const series = [...map.values()].sort((a, b) => a.month.localeCompare(b.month));
  series.forEach((p) => (p.savings = p.income - p.expense));
  return series;
}

export interface SavingsStats {
  monthlySavings: number; // current month
  yearlySavings: number; // current calendar year
  averageSavings: number; // mean across months with activity
  savingsRate: number; // current month savings %
  bestMonth: MonthlyPoint | null;
  worstMonth: MonthlyPoint | null;
}

export async function savingsStats(userId: number): Promise<SavingsStats> {
  const series = await monthlySeries(userId);
  const now = new Date().toISOString().slice(0, 7);
  const year = now.slice(0, 4);

  const current = series.find((p) => p.month === now);
  const yearly = series
    .filter((p) => p.month.startsWith(year))
    .reduce((sum, p) => sum + p.savings, 0);
  const average = series.length ? series.reduce((s, p) => s + p.savings, 0) / series.length : 0;

  const sorted = [...series].sort((a, b) => b.savings - a.savings);
  const monthlySavings = current?.savings ?? 0;
  const monthlyIncome = current?.income ?? 0;

  return {
    monthlySavings,
    yearlySavings: yearly,
    averageSavings: Math.round(average),
    savingsRate: monthlyIncome > 0 ? Math.round((monthlySavings / monthlyIncome) * 100) : 0,
    bestMonth: sorted[0] ?? null,
    worstMonth: sorted.length ? sorted[sorted.length - 1] : null,
  };
}

/** Expense totals grouped by category for a given month (YYYY-MM). */
export async function expenseByCategory(
  userId: number,
  month: string,
): Promise<{ category: string; total: number }[]> {
  const rows = await db
    .prepare(
      `SELECT category, SUM(amount) AS total
       FROM expenses WHERE user_id = ? AND substr(date, 1, 7) = ?
       GROUP BY category ORDER BY total DESC`,
    )
    .all(userId, month);
  return rows.map((r) => ({ category: String(r.category), total: num(r.total) }));
}

/**
 * A simple, explainable financial-health score (0–100) combining:
 *  - savings rate (up to 50 pts)
 *  - budget adherence (up to 25 pts)
 *  - having active goals (up to 25 pts)
 */
export async function financialHealthScore(userId: number): Promise<number> {
  const stats = await savingsStats(userId);
  const now = new Date().toISOString().slice(0, 7);

  const rateScore = Math.max(0, Math.min(50, (stats.savingsRate / 30) * 50)); // 30% rate == full

  const userRow = await db.prepare('SELECT monthly_budget FROM users WHERE id = ?').get(userId);
  const monthlyBudget = num(userRow?.monthly_budget);

  const spentRow = await db
    .prepare('SELECT SUM(amount) AS t FROM expenses WHERE user_id = ? AND substr(date, 1, 7) = ?')
    .get(userId, now);
  const spent = num(spentRow?.t);
  const budgetScore =
    monthlyBudget > 0 ? Math.max(0, Math.min(25, (1 - spent / monthlyBudget) * 25)) : 12.5;

  const goalRow = await db.prepare('SELECT COUNT(*) AS c FROM goals WHERE user_id = ?').get(userId);
  const goalScore = num(goalRow?.c) > 0 ? 25 : 0;

  return Math.round(rateScore + budgetScore + goalScore);
}

/**
 * Heuristic monthly insights. Compares the current month with the previous
 * one and surfaces human-readable observations and suggestions.
 */
export async function generateInsights(userId: number): Promise<string[]> {
  const series = await monthlySeries(userId);
  if (series.length === 0) return ['Add some income and expenses to unlock personalized insights.'];

  const now = new Date().toISOString().slice(0, 7);
  const currentIdx = series.findIndex((p) => p.month === now);
  const current = series[currentIdx] ?? series[series.length - 1];
  const previous = series[currentIdx - 1] ?? series[series.length - 2];

  const insights: string[] = [];

  if (current.income > 0) {
    const rate = Math.round((current.savings / current.income) * 100);
    insights.push(`You saved ${rate}% of your income this month.`);
  }

  // Category comparison vs previous month.
  const cats = await expenseByCategory(userId, current.month);
  if (cats.length) {
    const top = cats.slice(0, 3).map((c) => c.category);
    insights.push(`Your top expense categories are: ${top.join(', ')}.`);

    if (previous) {
      const prevCats = new Map(
        (await expenseByCategory(userId, previous.month)).map((c) => [c.category, c.total]),
      );
      for (const c of cats.slice(0, 5)) {
        const prev = prevCats.get(c.category) ?? 0;
        if (prev > 0) {
          const change = Math.round(((c.total - prev) / prev) * 100);
          if (Math.abs(change) >= 15) {
            const dir = change > 0 ? 'more' : 'less';
            insights.push(`You spent ${Math.abs(change)}% ${dir} on ${c.category} this month.`);
          }
        }
      }
    }
  }

  // Suggested saving target: 20% of average income.
  const avgIncome = series.reduce((s, p) => s + p.income, 0) / Math.max(1, series.length);
  if (avgIncome > 0) {
    insights.push(`A healthy monthly saving target for you is about ${Math.round(avgIncome * 0.2)}.`);
  }

  if (current.savings < 0) {
    insights.push(
      'Heads up: your expenses exceeded your income this month. Review discretionary spending.',
    );
  }

  return insights;
}
