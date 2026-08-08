/**
 * Authentication screen — email login/register, a Google sign-in stub, and a
 * "forgot password" helper. Designed as a polished split-panel hero.
 */
import { FormEvent, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import { IconWallet } from '../components/Icons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

type Mode = 'login' | 'register';

export default function Login() {
  const { login, register, loginWithGoogle } = useAuth();
  const { notify } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  // Handle the redirect back from the email verification link (/login?verified=1|0).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    if (verified === '1') {
      notify('Email verified! You can now sign in.', 'success');
    } else if (verified === '0') {
      notify('That verification link is invalid or has expired.', 'error');
    }
    if (verified !== null) window.history.replaceState({}, '', '/login');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        notify('Welcome back!', 'success');
      } else {
        const res = await register(name, email, password);
        notify(
          res.message ?? 'Account created. Check your email for a verification link.',
          res.emailSent === false ? 'warning' : 'success',
        );
        // Registration doesn't sign you in — switch to the sign-in view.
        setMode('login');
        setPassword('');
      }
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  };

  const demoLogin = async () => {
    setBusy(true);
    try {
      await login('demo@savings.app', 'demo1234');
      notify('Signed in with the demo account', 'success');
    } catch {
      notify('Demo account not found. Run `npm run seed` in the server.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    // In production, replace this with a Firebase Google sign-in that yields
    // the user's verified email + name, then calls loginWithGoogle().
    const emailInput = window.prompt('Enter your Google email (demo Google sign-in):');
    if (!emailInput) return;
    setBusy(true);
    try {
      await loginWithGoogle(emailInput, emailInput.split('@')[0]);
      notify('Signed in with Google', 'success');
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Google sign-in failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const forgot = () => {
    notify(
      'Password reset is handled by your identity provider (Firebase). See docs/DEPLOYMENT.md.',
      'info',
    );
  };

  return (
    <div className="auth-wrap">
      {/* Hero panel */}
      <div className="auth-hero">
        <div className="brand-mark" style={{ padding: 0, marginBottom: 32 }}>
          <span className="brand-logo"><IconWallet width={22} height={22} /></span>
          <span className="brand-name" style={{ color: '#fff' }}>Smart Savings</span>
        </div>
        <h1 style={{ color: '#fff', fontSize: '2.2rem', lineHeight: 1.15 }}>
          Take control of every rupee you earn and spend.
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.85)', marginTop: 16, fontSize: '1.02rem', lineHeight: 1.6 }}>
          Track income and expenses, set savings goals, plan budgets, and get
          personalized insights — all in one beautiful, private dashboard.
        </p>
        <ul className="hero-list">
          <li>📊 Automatic savings & health score</li>
          <li>🎯 Goal planner with progress tracking</li>
          <li>🧠 Monthly AI-style financial insights</li>
          <li>🌙 Dark mode, responsive on every device</li>
        </ul>
      </div>

      {/* Form panel */}
      <div className="auth-form">
        <div className="card card-pad" style={{ width: '100%', maxWidth: 380 }}>
          <h2 style={{ fontSize: '1.5rem' }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="muted" style={{ marginTop: 4, marginBottom: 20, fontSize: '0.9rem' }}>
            {mode === 'login' ? 'Sign in to continue to your dashboard.' : 'Start tracking your savings in seconds.'}
          </p>

          <form onSubmit={submit} className="stack" style={{ gap: 14 }}>
            {mode === 'register' && (
              <div className="field">
                <label>Full name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Jane Doe" />
              </div>
            )}
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
            </div>

            {mode === 'login' && (
              <button type="button" onClick={forgot} className="link-btn">Forgot password?</button>
            )}

            <button className="btn btn-primary" type="submit" disabled={busy} style={{ width: '100%' }}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="divider"><span>or</span></div>

          <button className="btn btn-ghost" onClick={googleLogin} disabled={busy} style={{ width: '100%' }}>
            <GoogleG /> Continue with Google
          </button>
          <button className="btn btn-ghost" onClick={demoLogin} disabled={busy} style={{ width: '100%', marginTop: 10 }}>
            🚀 Try the demo account
          </button>

          <p className="center muted" style={{ marginTop: 20, fontSize: '0.88rem' }}>
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button className="link-btn" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
              {mode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>

      <style>{`
        .auth-wrap { display: grid; grid-template-columns: 1.1fr 1fr; min-height: 100vh; }
        .auth-hero {
          background: linear-gradient(150deg, #4f46e5, #7c3aed 55%, #9333ea);
          padding: 56px 52px; display: flex; flex-direction: column; justify-content: center;
        }
        .hero-list { list-style: none; padding: 0; margin: 32px 0 0; display: grid; gap: 14px; }
        .hero-list li { color: #fff; font-weight: 500; font-size: 0.98rem; }
        .auth-form { display: grid; place-items: center; padding: 24px; background: var(--bg); }
        .divider { display: flex; align-items: center; gap: 12px; margin: 18px 0; color: var(--text-muted); font-size: 0.8rem; }
        .divider::before, .divider::after { content: ''; flex: 1; height: 1px; background: var(--border); }
        .link-btn { background: none; border: none; color: var(--brand); font-weight: 600; cursor: pointer; font-size: 0.88rem; padding: 0; font-family: inherit; }
        @media (max-width: 860px) { .auth-hero { display: none; } .auth-wrap { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.1 0 24 0 14.6 0 6.5 5.4 2.5 13.2l7.9 6.1C12.3 13.3 17.6 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.7-9.9 6.7-17.4z" />
      <path fill="#FBBC05" d="M10.4 28.3c-.5-1.5-.8-3.1-.8-4.8s.3-3.3.8-4.8l-7.9-6.1C.9 15.7 0 19.7 0 24s.9 8.3 2.5 11.4l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.1 0 11.3-2 15-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.7 2.2-6.4 0-11.7-3.8-13.6-9.3l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}
