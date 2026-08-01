/**
 * Top-level routing. Authenticated routes are wrapped in the app Layout;
 * unauthenticated users are redirected to /login.
 */
import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { Loader } from './components/ui';
import { useAuth } from './context/AuthContext';
import Budgets from './pages/Budgets';
import Dashboard from './pages/Dashboard';
import Expenses from './pages/Expenses';
import Goals from './pages/Goals';
import Income from './pages/Income';
import Login from './pages/Login';
import Reports from './pages/Reports';
import Settings from './pages/Settings';

function Protected({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader label="Restoring your session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route
        path="/login"
        element={loading ? <Loader /> : user ? <Navigate to="/" replace /> : <Login />}
      />
      <Route path="/" element={<Protected><Dashboard /></Protected>} />
      <Route path="/income" element={<Protected><Income /></Protected>} />
      <Route path="/expenses" element={<Protected><Expenses /></Protected>} />
      <Route path="/goals" element={<Protected><Goals /></Protected>} />
      <Route path="/budgets" element={<Protected><Budgets /></Protected>} />
      <Route path="/reports" element={<Protected><Reports /></Protected>} />
      <Route path="/settings" element={<Protected><Settings /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
