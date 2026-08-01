/**
 * Application shell: a responsive sidebar (collapses to a bottom nav on
 * mobile), a top bar with theme toggle + user menu, and the routed content.
 */
import { ReactNode, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  IconBudget,
  IconDashboard,
  IconExpense,
  IconGoal,
  IconIncome,
  IconLogout,
  IconMoon,
  IconReport,
  IconSettings,
  IconSun,
  IconWallet,
} from './Icons';

const NAV = [
  { to: '/', label: 'Dashboard', icon: <IconDashboard />, end: true },
  { to: '/income', label: 'Income', icon: <IconIncome /> },
  { to: '/expenses', label: 'Expenses', icon: <IconExpense /> },
  { to: '/goals', label: 'Goals', icon: <IconGoal /> },
  { to: '/budgets', label: 'Budgets', icon: <IconBudget /> },
  { to: '/reports', label: 'Reports', icon: <IconReport /> },
  { to: '/settings', label: 'Settings', icon: <IconSettings /> },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { resolved, toggle } = useTheme();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="brand-mark">
          <span className="brand-logo">
            <IconWallet width={22} height={22} />
          </span>
          <span className="brand-name">
            Smart<span style={{ color: 'var(--brand)' }}>Savings</span>
          </span>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {n.icon}
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer muted">Smart Savings Tracker v1.0</div>
      </aside>

      {/* Main */}
      <div className="main">
        <header className="topbar">
          <div className="topbar-title">Personal Finance</div>
          <div className="row" style={{ gap: 8 }}>
            <button className="btn btn-ghost btn-sm" onClick={toggle} title="Toggle theme">
              {resolved === 'dark' ? <IconSun width={18} height={18} /> : <IconMoon width={18} height={18} />}
            </button>
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setMenuOpen((o) => !o)}
                style={{ gap: 8 }}
              >
                <span className="avatar">{user?.name?.[0]?.toUpperCase() ?? 'U'}</span>
                <span className="hide-mobile">{user?.name}</span>
              </button>
              {menuOpen && (
                <div
                  className="card"
                  style={{ position: 'absolute', right: 0, top: 44, minWidth: 200, zIndex: 50, padding: 8 }}
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{user?.name}</div>
                    <div className="muted" style={{ fontSize: '0.78rem' }}>{user?.email}</div>
                  </div>
                  <button className="menu-item" onClick={() => { setMenuOpen(false); navigate('/settings'); }}>
                    <IconSettings width={16} height={16} /> Settings
                  </button>
                  <button className="menu-item" onClick={handleLogout}>
                    <IconLogout width={16} height={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="bottom-nav">
        {NAV.slice(0, 5).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => `bottom-link ${isActive ? 'active' : ''}`}
          >
            {n.icon}
            <span>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <LayoutStyles />
    </div>
  );
}

/** Layout-scoped styles kept alongside the component for cohesion. */
function LayoutStyles() {
  return (
    <style>{`
      .app-shell { display: flex; min-height: 100vh; }
      .sidebar {
        width: 250px; flex-shrink: 0; background: var(--surface);
        border-right: 1px solid var(--border); padding: 20px 14px;
        display: flex; flex-direction: column; position: sticky; top: 0; height: 100vh;
      }
      .brand-mark { display: flex; align-items: center; gap: 10px; padding: 6px 8px 20px; }
      .brand-logo {
        width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center;
        background: linear-gradient(135deg, var(--brand), #8b5cf6); color: #fff;
      }
      .brand-name { font-weight: 800; font-size: 1.1rem; letter-spacing: -0.02em; }
      .nav { display: flex; flex-direction: column; gap: 4px; flex: 1; }
      .nav-link {
        display: flex; align-items: center; gap: 12px; padding: 11px 12px; border-radius: 11px;
        color: var(--text-muted); font-weight: 600; font-size: 0.9rem; transition: all 0.15s ease;
      }
      .nav-link:hover { background: var(--surface-2); color: var(--text); }
      .nav-link.active { background: var(--brand-soft); color: var(--brand); }
      .sidebar-footer { font-size: 0.72rem; padding: 10px 8px 0; }
      .main { flex: 1; display: flex; flex-direction: column; min-width: 0; }
      .topbar {
        height: 64px; display: flex; align-items: center; justify-content: space-between;
        padding: 0 24px; border-bottom: 1px solid var(--border);
        background: var(--surface); position: sticky; top: 0; z-index: 40;
      }
      .topbar-title { font-weight: 700; font-size: 0.95rem; color: var(--text-muted); }
      .avatar {
        width: 26px; height: 26px; border-radius: 50%; display: grid; place-items: center;
        background: var(--brand); color: #fff; font-size: 0.8rem; font-weight: 700;
      }
      .menu-item {
        display: flex; align-items: center; gap: 10px; width: 100%; text-align: left;
        padding: 9px 10px; border: none; background: transparent; color: var(--text);
        border-radius: 8px; cursor: pointer; font-size: 0.88rem; font-family: inherit;
      }
      .menu-item:hover { background: var(--surface-2); }
      .content { padding: 24px; max-width: 1240px; width: 100%; margin: 0 auto; }
      .bottom-nav { display: none; }
      .hide-mobile { display: inline; }

      @media (max-width: 860px) {
        .sidebar { display: none; }
        .content { padding: 16px 14px 90px; }
        .bottom-nav {
          display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 80;
          background: var(--surface); border-top: 1px solid var(--border);
          justify-content: space-around; padding: 8px 4px;
        }
        .bottom-link {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          color: var(--text-muted); font-size: 0.66rem; font-weight: 600; padding: 4px 8px;
          border-radius: 10px;
        }
        .bottom-link.active { color: var(--brand); }
        .hide-mobile { display: none; }
      }
    `}</style>
  );
}
