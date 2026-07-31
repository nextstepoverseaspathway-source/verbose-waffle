/**
 * Shared domain types for the Smart Savings Tracker API.
 * These mirror the database schema and are reused across routes.
 */

export interface User {
  id: number;
  email: string;
  name: string;
  password_hash: string | null; // null when the account is federated (Google)
  provider: 'email' | 'google';
  currency: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  monthly_budget: number;
  created_at: string;
}

/** User object safe to send to the client (no secrets). */
export type PublicUser = Omit<User, 'password_hash'>;

export interface Income {
  id: number;
  user_id: number;
  date: string; // ISO date (YYYY-MM-DD)
  source: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  received_from: string | null;
  reference_number: string | null;
  recurring: 0 | 1;
  notes: string | null;
  created_at: string;
}

export interface Expense {
  id: number;
  user_id: number;
  date: string;
  category: string;
  subcategory: string | null;
  description: string | null;
  amount: number;
  payment_method: string | null;
  vendor: string | null;
  tax: number | null;
  receipt_path: string | null;
  recurring: 0 | 1;
  notes: string | null;
  created_at: string;
}

export interface Goal {
  id: number;
  user_id: number;
  name: string;
  type: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  monthly_contribution: number;
  created_at: string;
}

export interface Budget {
  id: number;
  user_id: number;
  category: string;
  /** Month the budget applies to, as YYYY-MM. Null means recurring/default. */
  month: string | null;
  amount: number;
}

/** Express request augmented with the authenticated user id. */
export interface AuthedLocals {
  userId: number;
}
