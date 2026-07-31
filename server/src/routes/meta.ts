/**
 * Public metadata used to populate client dropdowns.
 * No auth required — this is static reference data.
 */
import { Router } from 'express';
import {
  EXPENSE_CATEGORIES,
  GOAL_TYPES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  SUPPORTED_CURRENCIES,
} from '../utils/constants';

const router = Router();

router.get('/', (_req, res) => {
  res.json({
    incomeCategories: INCOME_CATEGORIES,
    expenseCategories: EXPENSE_CATEGORIES,
    paymentMethods: PAYMENT_METHODS,
    goalTypes: GOAL_TYPES,
    currencies: SUPPORTED_CURRENCIES,
  });
});

export default router;
