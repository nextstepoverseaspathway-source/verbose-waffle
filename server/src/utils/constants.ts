/**
 * Domain constants: income & expense taxonomies and goal types.
 * Kept server-side for validation & seeding; the client mirrors these.
 */

export const INCOME_CATEGORIES = [
  'Salary',
  'Business',
  'Freelancing',
  'Rental Income',
  'Interest',
  'Dividend',
  'Investment Return',
  'Commission',
  'Bonus',
  'Cash Gift',
  'Refund',
  'Government Benefit',
  'Other',
] as const;

/** Expense categories mapped to their optional subcategories. */
export const EXPENSE_CATEGORIES: Record<string, string[]> = {
  Housing: ['House Rent', 'Home Loan EMI'],
  Utilities: ['Electricity', 'Water Bill', 'Gas', 'Internet', 'Mobile Recharge'],
  Food: ['Groceries', 'Vegetables', 'Milk', 'Food Delivery', 'Restaurant', 'Tea/Coffee'],
  Transport: ['Fuel', 'Vehicle Maintenance', 'Public Transport', 'Parking'],
  Health: ['Medical', 'Medicines', 'Doctor', 'Insurance', 'Gym'],
  Education: ['School Fees', 'College Fees', 'Books'],
  Personal: ['Clothing', 'Shoes', 'Beauty', 'Salon'],
  Entertainment: ['Movies', 'OTT Subscription'],
  Travel: ['Hotels', 'Flights'],
  Shopping: ['Electronics', 'Gifts'],
  Giving: ['Donations', 'Festival'],
  Family: ['Pet Expenses', 'Child Expenses'],
  Finance: ['Loan EMI', 'Credit Card Payment', 'Taxes'],
  Investment: ['Mutual Funds', 'Stocks', 'Gold'],
  Other: ['Emergency', 'Miscellaneous'],
};

/** Flat list of every expense category for validation. */
export const EXPENSE_CATEGORY_LIST = Object.keys(EXPENSE_CATEGORIES);

export const PAYMENT_METHODS = [
  'Cash',
  'Debit Card',
  'Credit Card',
  'UPI',
  'Net Banking',
  'Wallet',
  'Cheque',
  'Other',
] as const;

export const GOAL_TYPES = [
  'Emergency Fund',
  'Vacation',
  'Car',
  'Home',
  'Education',
  'Wedding',
  'Investment',
  'Custom Goal',
] as const;

export const SUPPORTED_CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AUD', 'CAD', 'SGD', 'AED'] as const;
