/**
 * Budget planner — set a monthly spend limit per category and track
 * spent / remaining / percentage-used against live expense data.
 */
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { IconPlus, IconTrash } from '../components/Icons';
import { Card, EmptyState, Loader, Modal, ProgressBar, SectionTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { BudgetRow } from '../types';
import { currentMonth, formatCurrency, formatMonth } from '../utils/format';

export default function Budgets() {
  const { user } = useAuth();
  const meta = useMeta();
  const { notify } = useToast();
  const currency = user?.currency ?? 'INR';

  const [month, setMonth] = useState(currentMonth());
  const [rows, setRows] = useState<BudgetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<{ data: BudgetRow[] }>(`/budgets?month=${month}`)
      .then((r) => setRows(r.data))
      .catch(() => notify('Failed to load budgets', 'error'))
      .finally(() => setLoading(false));
  }, [month, notify]);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: number) => {
    if (!window.confirm('Remove this budget?')) return;
    await api.del(`/budgets/${id}`);
    notify('Budget removed', 'success');
    load();
  };

  const totalBudget = rows.reduce((s, r) => s + r.amount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);

  return (
    <div className="stack" style={{ gap: 18 }}>
      <SectionTitle
        title="Budget Planner"
        subtitle={formatMonth(month)}
        action={
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 'auto' }} />
            <button className="btn btn-primary" onClick={() => setAdding(true)}><IconPlus width={16} height={16} /> Set Budget</button>
          </div>
        }
      />

      {rows.length > 0 && (
        <div className="two-col">
          <Card>
            <div className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Budget</div>
            <div className="text-xl" style={{ marginTop: 6 }}>{formatCurrency(totalBudget, currency)}</div>
          </Card>
          <Card>
            <div className="row-between">
              <div>
                <div className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Total Spent</div>
                <div className="text-xl" style={{ marginTop: 6 }}>{formatCurrency(totalSpent, currency)}</div>
              </div>
              <span className={`badge ${totalSpent > totalBudget ? 'badge-red' : 'badge-green'}`}>
                {totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0}%
              </span>
            </div>
          </Card>
        </div>
      )}

      <Card style={{ padding: rows.length ? 20 : 0 }}>
        {loading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <EmptyState title="No budgets set for this month" hint="Set a limit per category to track your spending." action={<button className="btn btn-primary" onClick={() => setAdding(true)}>Set a budget</button>} />
        ) : (
          <div className="stack" style={{ gap: 16 }}>
            {rows.map((r) => {
              const over = r.percentUsed > 100;
              return (
                <div key={r.id}>
                  <div className="row-between" style={{ marginBottom: 6 }}>
                    <div className="row" style={{ gap: 8 }}>
                      <strong>{r.category}</strong>
                      {over && <span className="badge badge-red">Over budget</span>}
                      {!over && r.percentUsed >= 80 && <span className="badge badge-amber">Almost there</span>}
                    </div>
                    <div className="row" style={{ gap: 10 }}>
                      <span className="muted" style={{ fontSize: '0.85rem' }}>
                        {formatCurrency(r.spent, currency)} / {formatCurrency(r.amount, currency)}
                      </span>
                      <button className="icon-btn danger" onClick={() => remove(r.id)} title="Remove"><IconTrash width={15} height={15} /></button>
                    </div>
                  </div>
                  <ProgressBar percent={r.percentUsed} color={over ? 'var(--red)' : r.percentUsed >= 80 ? 'var(--amber)' : undefined} />
                  <div className="muted" style={{ marginTop: 5, fontSize: '0.8rem' }}>
                    {r.remaining >= 0 ? `${formatCurrency(r.remaining, currency)} remaining` : `${formatCurrency(-r.remaining, currency)} over`} · {r.percentUsed}% used
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal open={adding} title="Set Category Budget" onClose={() => setAdding(false)} width={460}>
        <BudgetForm month={month} categories={Object.keys(meta.expenseCategories)} onSaved={() => { setAdding(false); load(); notify('Budget saved', 'success'); }} onCancel={() => setAdding(false)} />
      </Modal>

      <style>{`
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .icon-btn { display: grid; place-items: center; width: 30px; height: 30px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; }
        .icon-btn.danger:hover { color: var(--red); border-color: var(--red); }
        @media (max-width: 640px) { .two-col { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function BudgetForm({ month, categories, onSaved, onCancel }: { month: string; categories: string[]; onSaved: () => void; onCancel: () => void }) {
  const { notify } = useToast();
  const [category, setCategory] = useState(categories[0] ?? '');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/budgets', { category, month, amount: Number(amount) });
      onSaved();
    } catch {
      notify('Failed to save budget', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
      <div className="field"><label>Category</label><select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select></div>
      <div className="field"><label>Monthly limit</label><input className="input" type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /></div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  );
}
