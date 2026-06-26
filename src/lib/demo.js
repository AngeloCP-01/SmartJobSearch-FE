import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

// Public, seeded demo account (see the backend seed script). Credentials are
// intentionally public so anyone can explore without signing up.
export const DEMO_EMAIL = 'demo@smartjobsearch.app';
export const DEMO_PASSWORD = 'demo1234';

// One-click demo sign-in, shared by the login page and the landing page.
export function useDemoLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [demoBusy, setDemoBusy] = useState(false);
  const [demoError, setDemoError] = useState(null);

  async function tryDemo() {
    setDemoError(null);
    setDemoBusy(true);
    try {
      await login({ email: DEMO_EMAIL, password: DEMO_PASSWORD, rememberMe: true });
      navigate('/');
    } catch (err) {
      setDemoError(err.response?.data?.error?.message || 'Demo is waking up — please try again in a moment.');
    } finally {
      setDemoBusy(false);
    }
  }

  return { tryDemo, demoBusy, demoError };
}
