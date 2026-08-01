/**
 * Reports — generate monthly/yearly/category/payment-method/goal reports and
 * export them to PDF, Excel, or CSV.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import { Card, Loader, SectionTitle } from '../components/ui';
import { SavingsStats } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { colorAt } from '../utils/colors';
import { exportCSV, exportExcel, exportPDF } from '../utils/exporters';
import { currentMonth, formatCompact, formatCurrency, formatMonth } from '../utils/format';

type ReportType = 'monthly' | 'yearly' | 'category' | 'payment-method' | 'goals';

const REPORTS: { key: ReportType; label: string }[] = [
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'category', label: 'Category-wise' },
  { key: 'payment-method', label: 'Payment Method' },
  { key: 'goals', label: 'Goal Progress' },
];

export default function Reports() {
  const { user } = useAuth();
  const { notify } = useToast();
  const currency = user?.currency ?? 'INR';

  const [type, setType] = useState<ReportType>('monthly');
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<any>(null);
  const [stats, setStats] = useState<SavingsStats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    const q =
      type === 'yearly' ? `?year=${year}` : type === 'goals' ? '' : `?month=${month}`;
    Promise.all([
      api.get<any>(`/reports/${type}${q}`),
      api.get<SavingsStats>('/dashboard/savings'),
    ])
      .then(([d, s]) => { setData(d); setStats(s); })
      .catch(() => notify('Failed to generate report', 'error'))
      .finally(() => setLoading(false));
  }, [type, month, year, notify]);

  useEffect(() => { load(); }, [load]);

  /** Flatten the current report into rows for CSV/Excel/PDF. */
  const reportRows = (): Record<string, string | number>[] => {
    if (!data) return [];
    switch (type) {
      case 'monthly':
      case 'category':
        return (data.categories ?? []).map((c: any) => ({ Category: c.category, Amount: c.total }));
      case 'yearly':
        return (data.series ?? []).map((p: any) => ({ Month: p.month, Income: p.income, Expense: p.expense, Savings: p.savings }));
      case 'payment-method':
        return (data.methods ?? []).map((m: any) => ({ Method: m.method, Amount: m.total }));
      case 'goals':
        return (data.goals ?? []).map((g: any) => ({ Goal: g.name, Type: g.type, Target: g.target_amount, Saved: g.current_amount, Progress: `${g.progress}%` }));
      default:
        return [];
    }
  };

  const label = REPORTS.find((r) => r.key === type)!.label;
  const period = type === 'yearly' ? year : type === 'goals' ? 'All time' : formatMonth(month);

  const doExport = (fmt: 'pdf' | 'csv' | 'excel') => {
    const rows = reportRows();
    if (!rows.length) return notify('Nothing to export', 'info');
    const name = `${type}-report-${period}`.replace(/\s+/g, '-').toLowerCase();
    if (fmt === 'csv') exportCSV(rows, `${name}.csv`);
    else if (fmt === 'excel') exportExcel(rows, `${name}.xls`, label);
    else {
      const headers = Object.keys(rows[0]);
      const html = `<h1>${label} Report</h1><div class="sub">${period} · generated ${new Date().toLocaleDateString()}</div>
        <table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${headers.map((h) => `<td>${r[h] ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      exportPDF(`${label} Report`, html);
    }
    notify('Report exported', 'success');
  };

  return (
    <div className="stack" style={{ gap: 18 }}>
      <SectionTitle
        title="Reports"
        subtitle="Generate and export financial reports"
        action={
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => doExport('csv')}>CSV</button>
            <button className="btn btn-ghost btn-sm" onClick={() => doExport('excel')}>Excel</button>
            <button className="btn btn-primary btn-sm" onClick={() => doExport('pdf')}>Export PDF</button>
          </div>
        }
      />

      {/* Controls */}
      <Card style={{ padding: 14 }}>
        <div className="row wrap" style={{ gap: 8 }}>
          <div className="report-tabs">
            {REPORTS.map((r) => (
              <button key={r.key} className={`tab ${type === r.key ? 'active' : ''}`} onClick={() => setType(r.key)}>{r.label}</button>
            ))}
          </div>
          <div className="grow" />
          {type === 'yearly' ? (
            <input className="input" type="number" value={year} onChange={(e) => setYear(e.target.value)} style={{ width: 110 }} />
          ) : type !== 'goals' ? (
            <input className="input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} style={{ width: 'auto' }} />
          ) : null}
        </div>
      </Card>

      {/* Savings summary strip */}
      {stats && (
        <div className="summary-strip">
          <SummaryCell label="This month" value={formatCurrency(stats.monthlySavings, currency)} />
          <SummaryCell label="This year" value={formatCurrency(stats.yearlySavings, currency)} />
          <SummaryCell label="Avg / month" value={formatCurrency(stats.averageSavings, currency)} />
          <SummaryCell label="Best month" value={stats.bestMonth ? formatMonth(stats.bestMonth.month) : '—'} />
          <SummaryCell label="Worst month" value={stats.worstMonth ? formatMonth(stats.worstMonth.month) : '—'} />
        </div>
      )}

      {loading || !data ? (
        <Loader label="Generating report…" />
      ) : (
        <Card>
          <h3 style={{ marginBottom: 16 }}>{label} Report · <span className="muted" style={{ fontWeight: 500 }}>{period}</span></h3>
          <ReportBody type={type} data={data} currency={currency} />
        </Card>
      )}

      <style>{`
        .report-tabs { display: flex; gap: 4px; flex-wrap: wrap; }
        .tab { border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); padding: 8px 14px; border-radius: 999px; font-size: 0.85rem; font-weight: 600; cursor: pointer; font-family: inherit; }
        .tab.active { background: var(--brand); color: #fff; border-color: var(--brand); }
        .summary-strip { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; }
        .summary-cell { background: var(--surface); border: 1px solid var(--border); border-radius: 14px; padding: 14px 16px; }
        @media (max-width: 900px) { .summary-strip { grid-template-columns: repeat(2, 1fr); } }
      `}</style>
    </div>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="summary-cell">
      <div className="muted" style={{ fontSize: '0.76rem', fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: '1.05rem', fontWeight: 700, marginTop: 4 }}>{value}</div>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text)', fontSize: 13 };

function ReportBody({ type, data, currency }: { type: ReportType; data: any; currency: string }) {
  if (type === 'yearly') {
    return (
      <>
        <div className="two-col" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
          <SummaryCell label="Total Income" value={formatCurrency(data.totalIncome, currency)} />
          <SummaryCell label="Total Expenses" value={formatCurrency(data.totalExpenses, currency)} />
          <SummaryCell label="Total Savings" value={formatCurrency(data.totalSavings, currency)} />
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data.series.map((p: any) => ({ ...p, label: p.month.slice(5) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} />
            <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => formatCompact(v, currency)} width={60} />
            <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="income" name="Income" stroke="#16a34a" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="expense" name="Expense" stroke="#ef4444" strokeWidth={2.5} dot={false} />
            <Line type="monotone" dataKey="savings" name="Savings" stroke="#4f46e5" strokeWidth={2.5} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </>
    );
  }

  if (type === 'monthly') {
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 18 }}>
          <SummaryCell label="Income" value={formatCurrency(data.totalIncome, currency)} />
          <SummaryCell label="Expenses" value={formatCurrency(data.totalExpenses, currency)} />
          <SummaryCell label="Savings" value={formatCurrency(data.savings, currency)} />
        </div>
        <CategoryTableAndChart categories={data.categories} currency={currency} />
      </>
    );
  }

  if (type === 'category') {
    return <CategoryTableAndChart categories={data.categories} currency={currency} />;
  }

  if (type === 'payment-method') {
    const rows = data.methods ?? [];
    return (
      <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie data={rows} dataKey="total" nameKey="method" cx="50%" cy="50%" outerRadius={100}>
              {rows.map((_: any, i: number) => <Cell key={i} fill={colorAt(i)} />)}
            </Pie>
            <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} />
          </PieChart>
        </ResponsiveContainer>
        <SimpleTable head={['Payment Method', 'Amount']} rows={rows.map((m: any) => [m.method, formatCurrency(m.total, currency)])} />
      </div>
    );
  }

  // goals
  const goals = data.goals ?? [];
  return (
    <SimpleTable
      head={['Goal', 'Type', 'Target', 'Saved', 'Progress']}
      rows={goals.map((g: any) => [g.name, g.type, formatCurrency(g.target_amount, currency), formatCurrency(g.current_amount, currency), `${g.progress}%`])}
    />
  );
}

function CategoryTableAndChart({ categories, currency }: { categories: any[]; currency: string }) {
  if (!categories?.length) return <div className="muted center" style={{ padding: 20 }}>No expenses in this period.</div>;
  return (
    <div className="two-col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={categories} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" stroke="var(--text-muted)" fontSize={11} tickFormatter={(v) => formatCompact(v, currency)} />
          <YAxis type="category" dataKey="category" stroke="var(--text-muted)" fontSize={11} width={90} />
          <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {categories.map((_, i) => <Cell key={i} fill={colorAt(i)} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <SimpleTable head={['Category', 'Amount']} rows={categories.map((c) => [c.category, formatCurrency(c.total, currency)])} />
    </div>
  );
}

function SimpleTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="table-wrap">
      <table className="data">
        <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
