/** Fetches static reference data (categories, payment methods) once and shares it. */
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { api } from '../api/client';
import { Meta } from '../types';

const FALLBACK: Meta = {
  incomeCategories: ['Salary', 'Business', 'Freelancing', 'Other'],
  expenseCategories: { Food: ['Groceries'], Housing: ['House Rent'], Other: ['Miscellaneous'] },
  paymentMethods: ['Cash', 'UPI', 'Credit Card', 'Debit Card', 'Net Banking'],
  goalTypes: ['Emergency Fund', 'Vacation', 'Custom Goal'],
  currencies: ['INR', 'USD', 'EUR', 'GBP'],
};

const MetaContext = createContext<Meta>(FALLBACK);

export function MetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<Meta>(FALLBACK);
  useEffect(() => {
    api.get<Meta>('/meta').then(setMeta).catch(() => setMeta(FALLBACK));
  }, []);
  return <MetaContext.Provider value={meta}>{children}</MetaContext.Provider>;
}

export const useMeta = () => useContext(MetaContext);
