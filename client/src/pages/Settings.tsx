/**
 * Settings — profile & preferences (currency, language, theme, monthly budget)
 * plus data management (backup, restore, CSV import, export, delete all).
 */
import { ChangeEvent, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Card, SectionTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { User } from '../types';
import { exportJSON, parseCSV } from '../utils/exporters';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी (Hindi)' },
  { code: 'es', label: 'Español' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'ar', label: 'العربية' },
];

export default function Settings() {
  const { user, setUser } = useAuth();
  const meta = useMeta();
  const { mode, setMode } = useTheme();
  const { notify } = useToast();

  const [form, setForm] = useState({
    name: user?.name ?? '',
    currency: user?.currency ?? 'INR',
    language: user?.language ?? 'en',
    monthly_budget: String(user?.monthly_budget ?? 0),
  });
  const [busy, setBusy] = useState(false);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const saveProfile = async () => {
    setBusy(true);
    try {
      const res = await api.put<{ user: User }>('/settings', {
        name: form.name,
        currency: form.currency,
        language: form.language,
        monthly_budget: Number(form.monthly_budget),
        theme: mode,
      });
      setUser(res.user);
      notify('Settings saved', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to save', 'error');
    } finally {
      setBusy(false);
    }
  };

  const backup = async () => {
    try {
      const data = await api.get('/settings/backup');
      exportJSON(data, `savings-backup-${new Date().toISOString().slice(0, 10)}.json`);
      notify('Backup downloaded', 'success');
    } catch {
      notify('Backup failed', 'error');
    }
  };

  const restore = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!window.confirm('Restoring will REPLACE all current data. Continue?')) return;
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        await api.post('/settings/restore', parsed);
        notify('Data restored. Reloading…', 'success');
        setTimeout(() => window.location.reload(), 900);
      } catch {
        notify('Invalid backup file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /** Import a CSV of transactions. Rows with a "type" of income go to income. */
  const importCSV = (kind: 'income' | 'expense') => (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const rows = parseCSV(String(reader.result));
      if (!rows.length) return notify('No rows found in CSV', 'warning');
      // Map common header names → fields (case-insensitive).
      const mapped = rows.map((r) => {
        const get = (...keys: string[]) => {
          for (const k of Object.keys(r)) {
            if (keys.includes(k.toLowerCase())) return r[k];
          }
          return undefined;
        };
        return {
          date: get('date') ?? new Date().toISOString().slice(0, 10),
          amount: Number(get('amount') ?? 0),
          category: get('category'),
          description: get('description', 'desc'),
          payment_method: get('paymentmethod', 'payment method', 'method'),
          vendor: get('vendor'),
          source: get('source'),
          notes: get('notes'),
        };
      });
      try {
        await api.post('/settings/import', kind === 'income' ? { incomes: mapped } : { expenses: mapped });
        notify(`Imported ${mapped.length} ${kind} rows`, 'success');
      } catch {
        notify('Import failed', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const deleteData = async () => {
    if (!window.confirm('Delete ALL your financial data? This cannot be undone.')) return;
    if (!window.confirm('Are you absolutely sure? Consider a backup first.')) return;
    try {
      await api.del('/settings/data');
      notify('All data deleted', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch {
      notify('Delete failed', 'error');
    }
  };

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 760 }}>
      <SectionTitle title="Settings" subtitle="Manage your profile, preferences, and data" />

      {/* Profile & preferences */}
      <Card>
        <h3 style={{ marginBottom: 16 }}>Profile & Preferences</h3>
        <div className="grid-form">
          <div className="field"><label>Name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
          <div className="field"><label>Email</label><input className="input" value={user?.email ?? ''} disabled /></div>
          <div className="field">
            <label>Currency</label>
            <select className="select" value={form.currency} onChange={(e) => set('currency', e.target.value)}>
              {meta.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Language</label>
            <select className="select" value={form.language} onChange={(e) => set('language', e.target.value)}>
              {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
            </select>
          </div>
          <div className="field"><label>Monthly budget</label><input className="input" type="number" min="0" value={form.monthly_budget} onChange={(e) => set('monthly_budget', e.target.value)} /></div>
          <div className="field">
            <label>Theme</label>
            <div className="row" style={{ gap: 6 }}>
              {(['light', 'dark', 'system'] as const).map((m) => (
                <button key={m} className={`btn btn-sm ${mode === m ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMode(m)} style={{ flex: 1, textTransform: 'capitalize' }}>{m}</button>
              ))}
            </div>
          </div>
        </div>
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={saveProfile} disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </Card>

      {/* Data management */}
      <Card>
        <h3 style={{ marginBottom: 4 }}>Data Management</h3>
        <p className="muted" style={{ fontSize: '0.88rem', marginBottom: 16 }}>Back up, restore, or import your financial data.</p>
        <div className="data-grid">
          <button className="btn btn-ghost" onClick={backup}>⬇️ Download Backup (JSON)</button>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            ⬆️ Restore Backup
            <input type="file" accept="application/json" hidden onChange={restore} />
          </label>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            📥 Import Income CSV
            <input type="file" accept=".csv" hidden onChange={importCSV('income')} />
          </label>
          <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
            📥 Import Expense CSV
            <input type="file" accept=".csv" hidden onChange={importCSV('expense')} />
          </label>
        </div>
      </Card>

      {/* Danger zone */}
      <Card style={{ borderColor: 'var(--red)' }}>
        <h3 style={{ color: 'var(--red)' }}>Danger Zone</h3>
        <div className="row-between wrap" style={{ marginTop: 12, gap: 12 }}>
          <div className="muted" style={{ fontSize: '0.88rem', maxWidth: 420 }}>
            Permanently delete all your income, expenses, goals, and budgets. Your account remains active.
          </div>
          <button className="btn btn-danger" onClick={deleteData}>Delete all data</button>
        </div>
      </Card>

      <style>{`
        .data-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (max-width: 560px) { .data-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
