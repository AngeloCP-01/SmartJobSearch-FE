import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  if (status === 'loading') {
    return <div className="grid min-h-dvh place-items-center text-slate-500">Loading…</div>;
  }
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  return children;
}
