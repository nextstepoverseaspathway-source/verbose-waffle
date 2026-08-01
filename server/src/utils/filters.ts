/**
 * Builds parameterized SQL WHERE clauses from query-string filters shared by
 * the income and expense endpoints. Keeps route handlers free of string
 * concatenation and guards against SQL injection via bound parameters.
 */
import { Request } from 'express';

export interface FilterResult {
  clause: string; // e.g. "AND date >= ? AND category = ?"
  params: unknown[];
}

export function buildTransactionFilters(
  req: Request,
  userId: number,
  /** Text columns to search for the free-text `q` filter (table-specific). */
  searchColumns: string[] = ['description', 'notes', 'category'],
): FilterResult {
  const params: unknown[] = [userId];
  const parts: string[] = ['user_id = ?'];

  const { from, to, month, year, category, payment_method, minAmount, maxAmount, q } =
    req.query as Record<string, string | undefined>;

  if (from) {
    parts.push('date >= ?');
    params.push(from);
  }
  if (to) {
    parts.push('date <= ?');
    params.push(to);
  }
  if (month) {
    // month = YYYY-MM
    parts.push("strftime('%Y-%m', date) = ?");
    params.push(month);
  }
  if (year) {
    parts.push("strftime('%Y', date) = ?");
    params.push(year);
  }
  if (category) {
    parts.push('category = ?');
    params.push(category);
  }
  if (payment_method) {
    parts.push('payment_method = ?');
    params.push(payment_method);
  }
  if (minAmount) {
    parts.push('amount >= ?');
    params.push(Number(minAmount));
  }
  if (maxAmount) {
    parts.push('amount <= ?');
    params.push(Number(maxAmount));
  }
  if (q && searchColumns.length > 0) {
    // Free-text search across the given descriptive columns.
    const like = `%${q}%`;
    parts.push('(' + searchColumns.map((c) => `${c} LIKE ?`).join(' OR ') + ')');
    searchColumns.forEach(() => params.push(like));
  }

  return { clause: parts.join(' AND '), params };
}
