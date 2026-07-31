/** Shared client-side types mirroring the API responses. */

export interface User {
  id: number;
  email: string;
  name: string;
  provider: 'email' | 'google';
  currency: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  monthly_budget: number;
  created_at: string;
}

export interface Income {
  id: number;
  date: string;
  source: string;
  category: string;
  description: string | null;
  amount: number;
  payment_method: string | null;
  received_from: string | null;
  reference_number: string | null;
  recurring: 0 | 1;
  notes: string | null;
}

export interface Expense {
  id: number;
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
}

export interface Goal {
  id: number;
  name: string;
  type: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  monthly_contribution: number;
  progress: number;
}

export interface BudgetRow {
  id: number;
  category: string;
  month: string | null;
  amount: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}

export interface DashboardSummary {
  month: string;
  currency: string;
  totalIncome: number;
  totalExpenses: number;
  totalSavings: number;
  savingsRate: number;
  monthlyBudget: number;
  remainingBudget: number;
  budgetUsedPercent: number;
  highestExpenseCategory: { category: string; total: number } | null;
  goalProgress: { saved: number; target: number };
  healthScore: number;
  upcomingBills: Array<{ id: number; category: string; subcategory: string | null; amount: number; date: string }>;
  recentTransactions: Array<{
    id: number;
    kind: 'income' | 'expense';
    date: string;
    category: string;
    label: string;
    amount: number;
  }>;
}

export interface MonthlyPoint {
  month: string;
  income: number;
  expense: number;
  savings: number;
}

export interface SavingsStats {
  monthlySavings: number;
  yearlySavings: number;
  averageSavings: number;
  savingsRate: number;
  bestMonth: MonthlyPoint | null;
  worstMonth: MonthlyPoint | null;
}

export interface Meta {
  incomeCategories: string[];
  expenseCategories: Record<string, string[]>;
  paymentMethods: string[];
  goalTypes: string[];
  currencies: string[];
}
