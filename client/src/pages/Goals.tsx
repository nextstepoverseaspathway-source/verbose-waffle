/**
 * Goal planner — create savings goals, track progress, log contributions,
 * and see the projected timeline based on the monthly contribution.
 */
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { IconGoal, IconPlus, IconTrash } from '../components/Icons';
import { Card, EmptyState, Loader, Modal, ProgressBar, SectionTitle } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { Goal } from '../types';
import { formatCurrency, formatDate } from '../utils/format';

const GOAL_ICONS: Record<string, string> = {
  'Emergency Fund': '🛟',
  Vacation: '🏖️',
  Car: '🚗',
  Home: '🏠',
  Education: '🎓',
  Wedding: '💍',
  Investment: '📈',
  'Custom Goal': '⭐',
};

export default function Goals() {
  const { user } = useAuth();
  const meta = useMeta();
  const { notify } = useToast();
  const currency = user?.currency ?? 'INR';

  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Goal | null>(null);
  const [creating, setCreating] = useState(false);
  const [contributing, setContributing] = useState<Goal | null>(null);

  const load = () => {
    setLoading(true);
    api.get<{ data: Goal[] }>('/goals').then((r) => setGoals(r.data)).catch(() => notify('Failed to load goals', 'error')).finally(() => setLoading(false));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (id: number) => {
    if (!window.confirm('Delete this goal?')) return;
    await api.del(`/goals/${id}`);
    notify('Goal deleted', 'success');
    load();
  };

  const monthsLeft = (g: Goal) => {
    if (g.monthly_contribution <= 0) return null;
    const remaining = Math.max(0, g.target_amount - g.current_amount);
    return Math.ceil(remaining / g.monthly_contribution);
  };

  if (loading) return <Loader label="Loading goals…" />;

  return (
    <div className="stack" style={{ gap: 18 }}>
      <SectionTitle
        title="Goal Planner"
        subtitle={`${goals.length} active goal${goals.length === 1 ? '' : 's'}`}
        action={<button className="btn btn-primary" onClick={() => setCreating(true)}><IconPlus width={16} height={16} /> New Goal</button>}
      />

      {goals.length === 0 ? (
        <Card><EmptyState title="No goals yet" hint="Set a target and start saving towards it." action={<button className="btn btn-primary" onClick={() => setCreating(true)}>Create your first goal</button>} /></Card>
      ) : (
        <div className="goal-grid">
          {goals.map((g) => {
            const months = monthsLeft(g);
            const done = g.progress >= 100;
            return (
              <Card key={g.id} className="animate-in">
                <div className="row-between">
                  <div className="row" style={{ gap: 10 }}>
                    <div className="goal-icon">{GOAL_ICONS[g.type] ?? '⭐'}</div>
                    <div>
                      <div style={{ fontWeight: 700 }}>{g.name}</div>
                      <div className="muted" style={{ fontSize: '0.8rem' }}>{g.type}</div>
                    </div>
                  </div>
                  <button className="icon-btn danger" onClick={() => remove(g.id)} title="Delete"><IconTrash width={16} height={16} /></button>
                </div>

                <div style={{ margin: '16px 0 6px' }} className="row-between">
                  <span className="text-lg">{formatCurrency(g.current_amount, currency)}</span>
                  <span className="muted">of {formatCurrency(g.target_amount, currency)}</span>
                </div>
                <ProgressBar percent={g.progress} color={done ? 'var(--green)' : undefined} />
                <div className="row-between" style={{ marginTop: 8, fontSize: '0.82rem' }}>
                  <span className={done ? 'pos' : 'muted'} style={{ fontWeight: 600 }}>{g.progress}% {done ? 'achieved 🎉' : 'complete'}</span>
                  {g.deadline && <span className="muted">by {formatDate(g.deadline)}</span>}
                </div>

                <div className="goal-meta">
                  <div><span className="muted">Monthly</span><br /><strong>{formatCurrency(g.monthly_contribution, currency)}</strong></div>
                  <div><span className="muted">Remaining</span><br /><strong>{formatCurrency(Math.max(0, g.target_amount - g.current_amount), currency)}</strong></div>
                  <div><span className="muted">ETA</span><br /><strong>{done ? 'Done' : months != null ? `${months} mo` : '—'}</strong></div>
                </div>

                <div className="row" style={{ gap: 8, marginTop: 14 }}>
                  <button className="btn btn-primary btn-sm grow" onClick={() => setContributing(g)} disabled={done}>+ Add contribution</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditing(g)}>Edit</button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={creating} title="New Goal" onClose={() => setCreating(false)}>
        <GoalForm types={meta.goalTypes} onSaved={() => { setCreating(false); load(); }} onCancel={() => setCreating(false)} />
      </Modal>
      <Modal open={editing !== null} title="Edit Goal" onClose={() => setEditing(null)}>
        {editing && <GoalForm types={meta.goalTypes} initial={editing} onSaved={() => { setEditing(null); load(); }} onCancel={() => setEditing(null)} />}
      </Modal>
      <Modal open={contributing !== null} title="Add Contribution" onClose={() => setContributing(null)} width={420}>
        {contributing && <ContributeForm goal={contributing} onSaved={() => { setContributing(null); load(); notify('Contribution added', 'success'); }} onCancel={() => setContributing(null)} />}
      </Modal>

      <style>{`
        .goal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
        .goal-icon { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; background: var(--brand-soft); font-size: 20px; }
        .goal-meta { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border); font-size: 0.82rem; }
        .icon-btn { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text-muted); cursor: pointer; }
        .icon-btn.danger:hover { color: var(--red); border-color: var(--red); }
      `}</style>
    </div>
  );
}

function GoalForm({ types, initial, onSaved, onCancel }: { types: string[]; initial?: Goal; onSaved: () => void; onCancel: () => void }) {
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? types[0] ?? 'Custom Goal',
    target_amount: initial?.target_amount != null ? String(initial.target_amount) : '',
    current_amount: initial?.current_amount != null ? String(initial.current_amount) : '0',
    deadline: initial?.deadline ?? '',
    monthly_contribution: initial?.monthly_contribution != null ? String(initial.monthly_contribution) : '',
  });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const payload = {
      name: form.name,
      type: form.type,
      target_amount: Number(form.target_amount),
      current_amount: Number(form.current_amount || 0),
      deadline: form.deadline || null,
      monthly_contribution: Number(form.monthly_contribution || 0),
    };
    try {
      if (initial) await api.put(`/goals/${initial.id}`, payload);
      else await api.post('/goals', payload);
      notify('Goal saved', 'success');
      onSaved();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed to save goal', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
      <div className="grid-form">
        <div className="field field-full"><label>Goal name</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required placeholder="e.g. Emergency Fund" /></div>
        <div className="field"><label>Type</label><select className="select" value={form.type} onChange={(e) => set('type', e.target.value)}>{types.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
        <div className="field"><label>Target amount</label><input className="input" type="number" min="1" value={form.target_amount} onChange={(e) => set('target_amount', e.target.value)} required /></div>
        <div className="field"><label>Current savings</label><input className="input" type="number" min="0" value={form.current_amount} onChange={(e) => set('current_amount', e.target.value)} /></div>
        <div className="field"><label>Monthly contribution</label><input className="input" type="number" min="0" value={form.monthly_contribution} onChange={(e) => set('monthly_contribution', e.target.value)} /></div>
        <div className="field field-full"><label>Deadline</label><input className="input" type="date" value={form.deadline} onChange={(e) => set('deadline', e.target.value)} /></div>
      </div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}><IconGoal width={16} height={16} /> {busy ? 'Saving…' : 'Save goal'}</button>
      </div>
    </form>
  );
}

function ContributeForm({ goal, onSaved, onCancel }: { goal: Goal; onSaved: () => void; onCancel: () => void }) {
  const { notify } = useToast();
  const [amount, setAmount] = useState(String(goal.monthly_contribution || ''));
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post(`/goals/${goal.id}/contribute`, { amount: Number(amount) });
      onSaved();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Failed', 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="stack" style={{ gap: 16 }}>
      <div className="field"><label>Contribution amount</label><input className="input" type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} required autoFocus /></div>
      <div className="row" style={{ justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Adding…' : 'Add'}</button>
      </div>
    </form>
  );
}
