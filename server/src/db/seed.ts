/**
 * Seed script — creates a demo user with several months of realistic
 * income, expenses, goals, and budgets so the app is explorable immediately.
 *
 * Run with:  npm run seed  (from repo root or server/)
 * Demo login: demo@savings.app / demo1234
 */
import bcrypt from 'bcryptjs';
import { db, initSchema } from './database';

initSchema();

const DEMO_EMAIL = 'demo@savings.app';
const DEMO_PASSWORD = 'demo1234';

function reset() {
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(DEMO_EMAIL) as
    | { id: number }
    | undefined;
  if (existing) {
    db.prepare('DELETE FROM users WHERE id = ?').run(existing.id); // cascades to all data
  }
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function seed() {
  reset();
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const userInfo = db
    .prepare(
      `INSERT INTO users (email, name, password_hash, provider, currency, theme, monthly_budget)
       VALUES (?, ?, ?, 'email', 'INR', 'system', 60000)`,
    )
    .run(DEMO_EMAIL, 'Demo User', hash);
  const userId = Number(userInfo.lastInsertRowid);

  const now = new Date();
  const insertIncome = db.prepare(
    `INSERT INTO incomes (user_id, date, source, category, description, amount, payment_method, recurring)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertExpense = db.prepare(
    `INSERT INTO expenses (user_id, date, category, subcategory, description, amount, payment_method, vendor, recurring)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  // Generate 6 months of data.
  const expenseTemplates: Array<[string, string, number, string, number]> = [
    // [category, subcategory, baseAmount, paymentMethod, recurring]
    ['Housing', 'House Rent', 18000, 'Net Banking', 1],
    ['Utilities', 'Electricity', 1800, 'UPI', 1],
    ['Utilities', 'Internet', 999, 'UPI', 1],
    ['Food', 'Groceries', 8500, 'Debit Card', 0],
    ['Food', 'Restaurant', 3200, 'Credit Card', 0],
    ['Transport', 'Fuel', 4500, 'Credit Card', 0],
    ['Entertainment', 'OTT Subscription', 649, 'Credit Card', 1],
    ['Health', 'Gym', 1500, 'UPI', 1],
    ['Shopping', 'Electronics', 5000, 'Credit Card', 0],
  ];

  for (let back = 5; back >= 0; back--) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;

    // Salary + occasional freelancing.
    insertIncome.run(userId, isoDate(year, month, 1), 'Monthly Salary', 'Salary', 'Net pay', 85000, 'Net Banking', 1);
    if (back % 2 === 0) {
      insertIncome.run(
        userId,
        isoDate(year, month, 15),
        'Side Project',
        'Freelancing',
        'Freelance invoice',
        12000 + back * 500,
        'UPI',
        0,
      );
    }

    // Expenses with a little month-to-month variance.
    expenseTemplates.forEach(([cat, sub, base, method, recurring], i) => {
      const variance = Math.round((Math.sin(back + i) * 0.15 + 1) * base);
      insertExpense.run(
        userId,
        isoDate(year, month, Math.min(28, 3 + i * 3)),
        cat,
        sub,
        `${sub} for ${year}-${String(month).padStart(2, '0')}`,
        variance,
        method,
        `${sub} Vendor`,
        recurring,
      );
    });
  }

  // Goals.
  db.prepare(
    `INSERT INTO goals (user_id, name, type, target_amount, current_amount, deadline, monthly_contribution)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, 'Emergency Fund', 'Emergency Fund', 300000, 145000, isoDate(now.getFullYear() + 1, 3, 31), 15000);
  db.prepare(
    `INSERT INTO goals (user_id, name, type, target_amount, current_amount, deadline, monthly_contribution)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(userId, 'Goa Vacation', 'Vacation', 80000, 32000, isoDate(now.getFullYear(), 12, 20), 8000);

  // Budgets for the current month.
  const currentMonth = now.toISOString().slice(0, 7);
  const budgets: Array<[string, number]> = [
    ['Housing', 20000],
    ['Food', 14000],
    ['Transport', 6000],
    ['Entertainment', 2000],
    ['Shopping', 6000],
  ];
  budgets.forEach(([cat, amt]) =>
    db
      .prepare('INSERT INTO budgets (user_id, category, month, amount) VALUES (?, ?, ?, ?)')
      .run(userId, cat, currentMonth, amt),
  );

  // eslint-disable-next-line no-console
  console.log(`✅ Seeded demo user.\n   Email: ${DEMO_EMAIL}\n   Password: ${DEMO_PASSWORD}`);
}

seed();
