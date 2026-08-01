/**
 * Shared list view for income and expense transactions, with search, filters
 * (date range, category, payment method, amount), CRUD, and CSV/Excel export.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { Expense, Income } from '../types';
import { exportCSV, exportExcel } from '../utils/exporters';
import { formatCurrency, formatDate } from '../utils/format';
import { IconEdit, IconPlus, IconSearch, IconTrash } from './Icons';
import TransactionForm from './TransactionForm';
import { Card, EmptyState, Loader, Modal, SectionTitle } from './ui';

type Kind = 'income' | 'expense';
type Row = Income & Expense;

interface Filters {
  q: string;
  from: string;
  to: string;
  category: string;
  payment_method: string;
  minAmount: string;
  maxAmount: string;
}

const EMPTY: Filters = { q: '', from: '', to: '', category: '', payment_method: '', minAmount: '', maxAmount: '' };

export default function TransactionsPage({ kind }: { kind: Kind }) {
  const { user } = useAuth();
  const meta = useMeta();
  const { notify } = useToast();
  const currency = user?.currency ?? 'INR';
  const path = kind === 'income' ? '/income' : '/expenses';

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [showFilters, setShowFilters] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [creating, setCreating] = useState(false);

  const categories =
    kind === 'income' ? meta.incomeCategories : Object.keys(meta.expenseCategories);

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.append(k, v));
    api
      .get<{ data: Row[] }>(`${path}?${params.toString()}`)
      .then((r) => setRows(r.data))
      .catch(() => notify('Failed to load transactions', 'error'))
      .finally(() => setLoading(false));
  }, [filters, path, notify]);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(() => rows.reduce((s, r) => s + r.amount, 0), [rows]);

  const remove = async (id: number) => {
    if (!window.confirm('Delete this entry? This cannot be undone.')) return;
    try {
      await api.del(`${path}/${id}`);
      notify('Deleted', 'success');
      load();
    } catch {
      notify('Failed to delete', 'error');
    }
  };

  const doExport = (format: 'csv' | 'excel') => {
    if (!rows.length) return notify('Nothing to export', 'info');
    const flat = rows.map((r) => ({
      Date: r.date,
      ...(kind === 'income'
        ? { Source: r.source, Category: r.category, ReceivedFrom: r.received_from }
        : { Category: r.category, Subcategory: r.subcategory, Vendor: r.vendor, Tax: r.tax }),
      Description: r.description,
      PaymentMethod: r.payment_method,
      Recurring: r.recurring ? 'Yes' : 'No',
      Amount: r.amount,
      Notes: r.notes,
    }));
    const name = `${kind}-export-${new Date().toISOString().slice(0, 10)}`;
    if (format === 'csv') exportCSV(flat, `${name}.csv`);
    else exportExcel(flat, `${name}.xls`, kind);
    notify(`Exported ${rows.length} rows`, 'success');
  };

  const title = kind === 'income' ? 'Income' : 'Expenses';

  return (
    <div className="stack" style={{ gap: 18 }}>
      <SectionTitle
        title={title}
        subtitle={`${rows.length} entries · ${formatCurrency(total, currency)} total`}
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => doExport('csv')}>CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={() => doExport('excel')}>Excel</button>
            <button className="btn btn-primary" onClick={() => setCreating(true)}>
              <IconPlus width={16} height={16} /> Add {title}
            </button>
          </div>
        }
      />

      {/* Search + filter toggle */}
      <Card style={{ padding: 14 }}>
        <div className="row wrap" style={{ gap: 10 }}>
          <div className="row grow" style={{ gap: 8, background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px', minWidth: 200 }}>
            <IconSearch width={16} height={16} style={{ color: 'var(--text-muted)' }} />
            <input
              placeholder="Search description, category, vendor…"
              value={filters.q}
              onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              style={{ border: 'none', background: 'transparent', color: 'var(--text)', outline: 'none', width: '100%', fontSize: '0.9rem' }}
            />
          </div>
          <button className="btn btn-ghost" onClick={() => setShowFilters((s) => !s)}>
            {showFilters ? 'Hide filters' : 'Filters'}
          </button>
          {Object.values(filters).some(Boolean) && (
            <button className="btn btn-ghost" onClick={() => setFilters(EMPTY)}>Clear</button>
          )}
        </div>

        {showFilters && (
          <div className="filter-grid" style={{ marginTop: 14 }}>
            <div className="field"><label>From</label><input className="input" type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} /></div>
            <div className="field"><label>To</label><input className="input" type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} /></div>
            <div className="field">
              <label>Category</label>
              <select className="select" value={filters.category} onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}>
                <option value="">All</option>
                {categories.map((c) => (<option key={c} value={c}>{c}</option>))}
              </select>
            </div>
            <div className="field">
              <label>Payment method</label>
              <select className="select" value={filters.payment_method} onChange={(e) => setFilters((f) => ({ ...f, payment_method: e.target.value }))}>
                <option value="">All</option>
                {meta.paymentMethods.map((m) => (<option key={m} value={m}>{m}</option>))}
              </select>
            </div>
            <div className="field"><label>Min amount</label><input className="input" type="number" value={filters.minAmount} onChange={(e) => setFilters((f) => ({ ...f, minAmount: e.target.value }))} /></div>
            <div className="field"><label>Max amount</label><input className="input" type="number" value={filters.maxAmount} onChange={(e) => setFilters((f) => ({ ...f, maxAmount: e.target.value }))} /></div>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card style={{ padding: 0 }}>
        {loading ? (
          <Loader />
        ) : rows.length === 0 ? (
          <EmptyState
            title={`No ${kind} entries`}
            hint="Add your first entry or adjust the filters."
            action={<button className="btn btn-primary" onClick={() => setCreating(true)}><IconPlus width={16} height={16} /> Add {title}</button>}
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Date</th>
                  {kind === 'income' ? <th>Source</th> : <th>Vendor</th>}
                  <th>Category</th>
                  <th>Description</th>
                  <th>Method</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      {kind === 'income' ? r.source : r.vendor || '—'}
                      {r.recurring ? <span className="badge badge-brand" style={{ marginLeft: 6 }}>↻</span> : null}
                    </td>
                    <td>{r.category}{kind === 'expense' && r.subcategory ? <span className="muted"> · {r.subcategory}</span> : null}</td>
                    <td className="muted">{r.description || '—'}</td>
                    <td>{r.payment_method || '—'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }} className={kind === 'income' ? 'pos' : 'neg'}>
                      {formatCurrency(r.amount, currency)}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4, justifyContent: 'flex-end' }}>
                        <button className="icon-btn" onClick={() => setEditing(r)} title="Edit"><IconEdit width={16} height={16} /></button>
                        <button className="icon-btn danger" onClick={() => remove(r.id)} title="Delete"><IconTrash width={16} height={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={creating} title={`Add ${title}`} onClose={() => setCreating(false)}>
        <TransactionForm kind={kind} onSaved={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />
      </Modal>

      <Modal open={editing !== null} title={`Edit ${title}`} onClose={() => setEditing(null)}>
        {editing && (
          <TransactionForm kind={kind} initial={editing} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />
        )}
      </Modal>

      <style>{`
        .filter-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .icon-btn { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; }
        .icon-btn:hover { background: var(--surface-2); color: var(--text); }
        .icon-btn.danger:hover { color: var(--red); border-color: var(--red); }
        @media (max-width: 720px) { .filter-grid { grid-template-columns: 1fr 1fr; } }
      `}</style>
    </div>
  );
}
