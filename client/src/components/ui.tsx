/** Reusable presentational components used throughout the app. */
import { ReactNode, useEffect } from 'react';

export function Card({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`card card-pad ${className}`} style={style}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'brand',
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: 'brand' | 'green' | 'red' | 'amber';
}) {
  const toneColor = {
    brand: 'var(--brand)',
    green: 'var(--green)',
    red: 'var(--red)',
    amber: 'var(--amber)',
  }[tone];
  const toneSoft = {
    brand: 'var(--brand-soft)',
    green: 'var(--green-soft)',
    red: 'var(--red-soft)',
    amber: 'var(--amber-soft)',
  }[tone];

  return (
    <Card className="animate-in">
      <div className="row-between" style={{ alignItems: 'flex-start' }}>
        <div>
          <div className="muted" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
            {label}
          </div>
          <div className="text-xl" style={{ marginTop: 6 }}>
            {value}
          </div>
          {hint && <div style={{ marginTop: 6, fontSize: '0.8rem' }}>{hint}</div>}
        </div>
        {icon && (
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              display: 'grid',
              placeItems: 'center',
              background: toneSoft,
              color: toneColor,
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
      </div>
    </Card>
  );
}

export function ProgressBar({ percent, color }: { percent: number; color?: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="progress">
      <span style={{ width: `${clamped}%`, ...(color ? { background: color } : {}) }} />
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="center" style={{ padding: '48px 20px', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: 40, marginBottom: 8 }}>📭</div>
      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{title}</div>
      {hint && <div style={{ marginTop: 6, fontSize: '0.88rem' }}>{hint}</div>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function Loader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="center" style={{ padding: 60, color: 'var(--text-muted)' }}>
      <div
        style={{
          width: 28,
          height: 28,
          border: '3px solid var(--border)',
          borderTopColor: 'var(--brand)',
          borderRadius: '50%',
          margin: '0 auto 12px',
          animation: 'spin 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {label}
    </div>
  );
}

export function Modal({
  open,
  title,
  onClose,
  children,
  width = 640,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  width?: number;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(8, 11, 18, 0.55)',
        backdropFilter: 'blur(3px)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 900,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="card animate-in"
        style={{ width: '100%', maxWidth: width, maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div
          className="row-between"
          style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}
        >
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="card-pad">{children}</div>
      </div>
    </div>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="row-between wrap" style={{ marginBottom: 4 }}>
      <div>
        <h2 style={{ fontSize: '1.4rem' }}>{title}</h2>
        {subtitle && <div className="muted" style={{ fontSize: '0.9rem', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}
