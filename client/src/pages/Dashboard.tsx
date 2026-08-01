/**
 * Home dashboard — the financial cockpit. Shows the month's headline numbers,
 * budget and goal progress, spending charts, AI-style insights, upcoming bills,
 * and recent transactions, plus quick-add actions.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/client';
import {
  IconBell,
  IconExpense,
  IconIncome,
  IconPlus,
  IconSpark,
  IconWallet,
} from '../components/Icons';
import TransactionForm from '../components/TransactionForm';
import { Card, EmptyState, Loader, Modal, ProgressBar, StatCard } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { DashboardSummary, MonthlyPoint } from '../types';
import { colorAt } from '../utils/colors';
import { formatCompact, formatCurrency, formatDate, formatMonth } from '../utils/format';

interface ChartData {
  series: MonthlyPoint[];
  expensePie: { category: string; total: number }[];
}

export default function Dashboard() {
  const { user } = useAuth();
  const { notify } = useToast();
  const currency = user?.currency ?? 'INR';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [charts, setCharts] = useState<ChartData | null>(null);
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAdd, setQuickAdd] = useState<'income' | 'expense' | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<DashboardSummary>('/dashboard'),
      api.get<ChartData>('/dashboard/charts'),
      api.get<{ insights: string[] }>('/dashboard/insights'),
    ])
      .then(([s, c, i]) => {
        setSummary(s);
        setCharts(c);
        setInsights(i.insights);
        // Proactive budget notification.
        if (s.monthlyBudget > 0 && s.budgetUsedPercent >= 90) {
          notify(`You've used ${s.budgetUsedPercent}% of your monthly budget.`, 'warning');
        }
      })
      .catch(() => notify('Failed to load dashboard', 'error'))
      .finally(() => setLoading(false));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const savingsSeries = useMemo(
    () => (charts?.series ?? []).map((p) => ({ ...p, label: p.month.slice(5) })),
    [charts],
  );

  if (loading || !summary) return <Loader label="Building your dashboard…" />;

  const goalPct =
    summary.goalProgress.target > 0
      ? Math.round((summary.goalProgress.saved / summary.goalProgress.target) * 100)
      : 0;

  return (
    <div className="stack" style={{ gap: 22 }}>
      {/* Header */}
      <div className="row-between wrap">
        <div>
          <h1 style={{ fontSize: '1.7rem' }}>Hello, {user?.name?.split(' ')[0]} 👋</h1>
          <div className="muted">{formatMonth(summary.month)} overview</div>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => setQuickAdd('income')}>
            <IconIncome width={16} height={16} /> Add Income
          </button>
          <button className="btn btn-primary" onClick={() => setQuickAdd('expense')}>
            <IconPlus width={16} height={16} /> Add Expense
          </button>
        </div>
      </div>

      {/* Stat grid */}
      <div className="stat-grid">
        <StatCard label="Total Income" tone="green" icon={<IconIncome />} value={formatCurrency(summary.totalIncome, currency)} />
        <StatCard label="Total Expenses" tone="red" icon={<IconExpense />} value={formatCurrency(summary.totalExpenses, currency)} />
        <StatCard
          label="Total Savings"
          tone={summary.totalSavings >= 0 ? 'brand' : 'red'}
          icon={<IconWallet />}
          value={formatCurrency(summary.totalSavings, currency)}
          hint={<span className={summary.savingsRate >= 0 ? 'pos' : 'neg'}>{summary.savingsRate}% savings rate</span>}
        />
        <StatCard
          label="Financial Health"
          tone={summary.healthScore >= 70 ? 'green' : summary.healthScore >= 40 ? 'amber' : 'red'}
          icon={<IconSpark />}
          value={`${summary.healthScore}/100`}
          hint={<span className="muted">{summary.healthScore >= 70 ? 'Great shape' : summary.healthScore >= 40 ? 'Doing okay' : 'Needs attention'}</span>}
        />
      </div>

      {/* Budget + Goal progress */}
      <div className="two-col">
        <Card>
          <div className="row-between">
            <h3>Monthly Budget</h3>
            <span className={`badge ${summary.budgetUsedPercent >= 90 ? 'badge-red' : summary.budgetUsedPercent >= 70 ? 'badge-amber' : 'badge-green'}`}>
              {summary.budgetUsedPercent}% used
            </span>
          </div>
          <div className="text-lg" style={{ margin: '12px 0 4px' }}>
            {formatCurrency(summary.totalExpenses, currency)}
            <span className="muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}> / {formatCurrency(summary.monthlyBudget, currency)}</span>
          </div>
          <ProgressBar percent={summary.budgetUsedPercent} color={summary.budgetUsedPercent >= 90 ? 'var(--red)' : undefined} />
          <div className="muted" style={{ marginTop: 8, fontSize: '0.85rem' }}>
            {summary.remainingBudget >= 0
              ? `${formatCurrency(summary.remainingBudget, currency)} remaining`
              : `${formatCurrency(-summary.remainingBudget, currency)} over budget`}
          </div>
        </Card>

        <Card>
          <div className="row-between">
            <h3>Savings Goals</h3>
            <span className="badge badge-brand">{goalPct}%</span>
          </div>
          <div className="text-lg" style={{ margin: '12px 0 4px' }}>
            {formatCurrency(summary.goalProgress.saved, currency)}
            <span className="muted" style={{ fontSize: '0.9rem', fontWeight: 500 }}> / {formatCurrency(summary.goalProgress.target, currency)}</span>
          </div>
          <ProgressBar percent={goalPct} />
          <div className="muted" style={{ marginTop: 8, fontSize: '0.85rem' }}>
            Highest expense: {summary.highestExpenseCategory
              ? `${summary.highestExpenseCategory.category} (${formatCurrency(summary.highestExpenseCategory.total, currency)})`
              : '—'}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="two-col">
        <Card>
          <h3 style={{ marginBottom: 12 }}>Income vs Expense vs Savings</h3>
          {savingsSeries.length === 0 ? (
            <EmptyState title="No data yet" hint="Add transactions to see trends." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={savingsSeries}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => formatCompact(v, currency)} width={60} />
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} />
                <Legend />
                <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} />
                <Bar dataKey="savings" name="Savings" fill="#4f46e5" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <h3 style={{ marginBottom: 12 }}>Expense Breakdown</h3>
          {(charts?.expensePie.length ?? 0) === 0 ? (
            <EmptyState title="No expenses this month" hint="Log an expense to see the split." />
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={charts!.expensePie} dataKey="total" nameKey="category" cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={2}>
                  {charts!.expensePie.map((_, i) => (<Cell key={i} fill={colorAt(i)} />))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Savings trend */}
      <Card>
        <h3 style={{ marginBottom: 12 }}>Savings Trend</h3>
        {savingsSeries.length === 0 ? (
          <EmptyState title="No trend yet" />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={savingsSeries}>
              <defs>
                <linearGradient id="savingsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f46e5" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={12} />
              <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => formatCompact(v, currency)} width={60} />
              <Tooltip formatter={(v: number) => formatCurrency(v, currency)} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="savings" stroke="#4f46e5" strokeWidth={2.5} fill="url(#savingsFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* Insights + bills */}
      <div className="two-col">
        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <IconSpark width={18} height={18} style={{ color: 'var(--brand)' }} />
            <h3>Smart Insights</h3>
          </div>
          <div className="stack" style={{ gap: 10 }}>
            {insights.map((text, i) => (
              <div key={i} className="insight-row">
                <span style={{ color: 'var(--brand)' }}>•</span>
                <span>{text}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <div className="row" style={{ gap: 8, marginBottom: 12 }}>
            <IconBell width={18} height={18} style={{ color: 'var(--amber)' }} />
            <h3>Upcoming / Recurring Bills</h3>
          </div>
          {summary.upcomingBills.length === 0 ? (
            <EmptyState title="No recurring bills" hint="Mark an expense as recurring to track it here." />
          ) : (
            <div className="stack" style={{ gap: 8 }}>
              {summary.upcomingBills.map((b) => (
                <div key={b.id} className="row-between bill-row">
                  <div>
                    <div style={{ fontWeight: 600 }}>{b.subcategory || b.category}</div>
                    <div className="muted" style={{ fontSize: '0.8rem' }}>{formatDate(b.date)}</div>
                  </div>
                  <div style={{ fontWeight: 700 }}>{formatCurrency(b.amount, currency)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Recent transactions */}
      <Card>
        <h3 style={{ marginBottom: 12 }}>Recent Transactions</h3>
        {summary.recentTransactions.length === 0 ? (
          <EmptyState title="No transactions yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr><th>Date</th><th>Type</th><th>Category</th><th>Details</th><th style={{ textAlign: 'right' }}>Amount</th></tr>
              </thead>
              <tbody>
                {summary.recentTransactions.map((t) => (
                  <tr key={`${t.kind}-${t.id}`}>
                    <td>{formatDate(t.date)}</td>
                    <td><span className={`badge ${t.kind === 'income' ? 'badge-green' : 'badge-red'}`}>{t.kind}</span></td>
                    <td>{t.category}</td>
                    <td className="muted">{t.label}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }} className={t.kind === 'income' ? 'pos' : 'neg'}>
                      {t.kind === 'income' ? '+' : '−'}{formatCurrency(t.amount, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Quick add modal */}
      <Modal open={quickAdd !== null} title={`Add ${quickAdd === 'income' ? 'Income' : 'Expense'}`} onClose={() => setQuickAdd(null)}>
        {quickAdd && (
          <TransactionForm
            kind={quickAdd}
            onSaved={() => { setQuickAdd(null); load(); }}
            onCancel={() => setQuickAdd(null)}
          />
        )}
      </Modal>

      <style>{`
        .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .insight-row { display: flex; gap: 10px; font-size: 0.9rem; line-height: 1.5; padding: 10px 12px; background: var(--surface-2); border-radius: 10px; }
        .bill-row { padding: 10px 12px; background: var(--surface-2); border-radius: 10px; }
        @media (max-width: 1000px) { .stat-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 780px) { .two-col { grid-template-columns: 1fr; } }
        @media (max-width: 480px) { .stat-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

const tooltipStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13,
};
