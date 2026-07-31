/**
 * Reusable create/edit form for both income and expense entries.
 * The `kind` prop switches the field set and category source.
 */
import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { Expense, Income } from '../types';
import { todayISO } from '../utils/format';

type Kind = 'income' | 'expense';

interface Props {
  kind: Kind;
  initial?: Partial<Income & Expense> & { id?: number };
  onSaved: () => void;
  onCancel: () => void;
}

export default function TransactionForm({ kind, initial, onSaved, onCancel }: Props) {
  const meta = useMeta();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Record<string, string | boolean>>({
    date: initial?.date ?? todayISO(),
    amount: initial?.amount != null ? String(initial.amount) : '',
    category: initial?.category ?? (kind === 'income' ? meta.incomeCategories[0] : Object.keys(meta.expenseCategories)[0]),
    description: initial?.description ?? '',
    payment_method: initial?.payment_method ?? '',
    notes: initial?.notes ?? '',
    recurring: initial?.recurring === 1,
    // income-specific
    source: initial?.source ?? '',
    received_from: initial?.received_from ?? '',
    reference_number: initial?.reference_number ?? '',
    // expense-specific
    subcategory: initial?.subcategory ?? '',
    vendor: initial?.vendor ?? '',
    tax: initial?.tax != null ? String(initial.tax) : '',
  });

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const subcategories =
    kind === 'expense' ? meta.expenseCategories[form.category as string] ?? [] : [];

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);

    const base = {
      date: form.date as string,
      category: form.category as string,
      description: (form.description as string) || null,
      amount: Number(form.amount),
      payment_method: (form.payment_method as string) || null,
      recurring: Boolean(form.recurring),
      notes: (form.notes as string) || null,
    };

    const payload =
      kind === 'income'
        ? {
            ...base,
            source: (form.source as string) || 'Income',
            received_from: (form.received_from as string) || null,
            reference_number: (form.reference_number as string) || null,
          }
        : {
            ...base,
            subcategory: (form.subcategory as string) || null,
            vendor: (form.vendor as string) || null,
            tax: form.tax ? Number(form.tax) : null,
          };

    const path = kind === 'income' ? '/income' : '/expenses';
    try {
      if (initial?.id) await api.put(`${path}/${initial.id}`, payload);
      else await api.post(path, payload);
      notify(`${kind === 'income' ? 'Income' : 'Expense'} saved`, 'success');
      onSaved();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to save', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
      <div className="grid-form">
        <div className="field">
          <label>Date</label>
          <input className="input" type="date" value={form.date as string} onChange={(e) => set('date', e.target.value)} required />
        </div>
        <div className="field">
          <label>Amount</label>
          <input className="input" type="number" min="0" step="0.01" value={form.amount as string} onChange={(e) => set('amount', e.target.value)} required placeholder="0" />
        </div>

        {kind === 'income' && (
          <div className="field">
            <label>Income source</label>
            <input className="input" value={form.source as string} onChange={(e) => set('source', e.target.value)} placeholder="e.g. Monthly Salary" />
          </div>
        )}

        <div className="field">
          <label>Category</label>
          <select className="select" value={form.category as string} onChange={(e) => set('category', e.target.value)}>
            {(kind === 'income' ? meta.incomeCategories : Object.keys(meta.expenseCategories)).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {kind === 'expense' && subcategories.length > 0 && (
          <div className="field">
            <label>Subcategory</label>
            <select className="select" value={form.subcategory as string} onChange={(e) => set('subcategory', e.target.value)}>
              <option value="">—</option>
              {subcategories.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
        )}

        <div className="field">
          <label>Payment method</label>
          <select className="select" value={form.payment_method as string} onChange={(e) => set('payment_method', e.target.value)}>
            <option value="">—</option>
            {meta.paymentMethods.map((m) => (<option key={m} value={m}>{m}</option>))}
          </select>
        </div>

        {kind === 'expense' && (
          <>
            <div className="field">
              <label>Vendor</label>
              <input className="input" value={form.vendor as string} onChange={(e) => set('vendor', e.target.value)} placeholder="e.g. BigBasket" />
            </div>
            <div className="field">
              <label>GST / Tax (optional)</label>
              <input className="input" type="number" min="0" step="0.01" value={form.tax as string} onChange={(e) => set('tax', e.target.value)} placeholder="0" />
            </div>
          </>
        )}

        {kind === 'income' && (
          <>
            <div className="field">
              <label>Received from</label>
              <input className="input" value={form.received_from as string} onChange={(e) => set('received_from', e.target.value)} placeholder="Payer" />
            </div>
            <div className="field">
              <label>Reference number</label>
              <input className="input" value={form.reference_number as string} onChange={(e) => set('reference_number', e.target.value)} placeholder="Txn / invoice #" />
            </div>
          </>
        )}

        <div className="field field-full">
          <label>Description</label>
          <input className="input" value={form.description as string} onChange={(e) => set('description', e.target.value)} placeholder="Short description" />
        </div>

        <div className="field field-full">
          <label>Notes</label>
          <textarea className="input" rows={2} value={form.notes as string} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes" />
        </div>

        <label className="field-full row" style={{ gap: 8, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.recurring as boolean} onChange={(e) => set('recurring', e.target.checked)} />
          <span style={{ fontSize: '0.9rem' }}>Recurring {kind}</span>
        </label>
      </div>

      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : initial?.id ? 'Update' : 'Save'}
        </button>
      </div>
    </form>
  );
}
