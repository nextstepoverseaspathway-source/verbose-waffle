/**
 * Lightweight toast notifications used across the app for success/error
 * feedback (e.g. budget-limit warnings, goal achievements, save confirmations).
 */
import { createContext, ReactNode, useCallback, useContext, useState } from 'react';

type ToastType = 'success' | 'error' | 'info' | 'warning';
interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  notify: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, string> = {
  success: '✅',
  error: '⛔',
  info: 'ℹ️',
  warning: '⚠️',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, type, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ notify }}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          zIndex: 1000,
          maxWidth: 'min(360px, calc(100vw - 40px))',
        }}
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className="card card-pad animate-in"
            style={{ display: 'flex', gap: 10, alignItems: 'center', boxShadow: 'var(--shadow-lg)' }}
          >
            <span>{ICONS[t.type]}</span>
            <span style={{ fontSize: '0.88rem' }}>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
