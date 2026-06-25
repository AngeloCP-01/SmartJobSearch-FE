import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import Spinner from '../components/Spinner';

export default function ProtectedRoute({ children }) {
  const { status } = useAuth();
  if (status === 'loading') {
    return <div className="grid min-h-dvh place-items-center"><Spinner /></div>;
  }
  if (status === 'anonymous') return <Navigate to="/login" replace />;
  return children;
}
