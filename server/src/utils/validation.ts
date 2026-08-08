/**
 * Zod validation schemas for request bodies.
 * Route handlers call `schema.parse(req.body)`; failures are turned into
 * 422 responses by the central error handler.
 */
import { z } from 'zod';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/**
 * A small blocklist of well-known weak passwords. Compared case-insensitively.
 * This is a pragmatic guard, not a substitute for a full breached-password
 * check — it simply rejects the most obvious choices.
 */
const WEAK_PASSWORDS = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'password1234',
  'passw0rd',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'demo1234',
  'demo12345',
  'admin123',
  'letmein123',
  'welcome123',
  'iloveyou1',
  'changeme123',
  'abcd1234',
  'test1234',
]);

/** Password policy: at least 8 characters and not a known weak password. */
const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(200)
  .refine((pw) => !WEAK_PASSWORDS.has(pw.toLowerCase()), {
    message: 'That password is too common. Please choose a stronger one.',
  });

export const registerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(120),
  email: z.string().email(),
  password: passwordField,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const incomeSchema = z.object({
  date: isoDate,
  source: z.string().min(1, 'Source is required').max(120),
  category: z.string().min(1),
  description: z.string().max(500).optional().nullable(),
  amount: z.number().nonnegative(),
  payment_method: z.string().max(60).optional().nullable(),
  received_from: z.string().max(120).optional().nullable(),
  reference_number: z.string().max(120).optional().nullable(),
  recurring: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

export const expenseSchema = z.object({
  date: isoDate,
  category: z.string().min(1, 'Category is required'),
  subcategory: z.string().max(60).optional().nullable(),
  description: z.string().max(500).optional().nullable(),
  amount: z.number().nonnegative(),
  payment_method: z.string().max(60).optional().nullable(),
  vendor: z.string().max(120).optional().nullable(),
  tax: z.number().nonnegative().optional().nullable(),
  recurring: z.boolean().optional().default(false),
  notes: z.string().max(1000).optional().nullable(),
});

export const goalSchema = z.object({
  name: z.string().min(1, 'Goal name is required').max(120),
  type: z.string().max(60).optional().default('Custom Goal'),
  target_amount: z.number().positive('Target must be greater than zero'),
  current_amount: z.number().nonnegative().optional().default(0),
  deadline: isoDate.optional().nullable(),
  monthly_contribution: z.number().nonnegative().optional().default(0),
});

export const budgetSchema = z.object({
  category: z.string().min(1),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Month must be YYYY-MM')
    .optional()
    .nullable(),
  amount: z.number().nonnegative(),
});

export const settingsSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  currency: z.string().min(1).max(8).optional(),
  language: z.string().min(1).max(8).optional(),
  theme: z.enum(['light', 'dark', 'system']).optional(),
  monthly_budget: z.number().nonnegative().optional(),
});

export type IncomeInput = z.infer<typeof incomeSchema>;
export type ExpenseInput = z.infer<typeof expenseSchema>;
export type GoalInput = z.infer<typeof goalSchema>;
export type BudgetInput = z.infer<typeof budgetSchema>;
