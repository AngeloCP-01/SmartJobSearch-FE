import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import Field from '../components/Field';
import Button from '../components/Button';

// Public demo account (seeded with realistic data) so reviewers can explore
// without signing up. See the backend seed script.
const DEMO_EMAIL = 'demo@smartjobsearch.app';
const DEMO_PASSWORD = 'demo1234';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ email, password, rememberMe: remember });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function tryDemo() {
    setError(null);
    setDemoBusy(true);
    try {
      await login({ email: DEMO_EMAIL, password: DEMO_PASSWORD, rememberMe: true });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Demo is waking up — please try again in a moment.');
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-sm rounded-2xl border border-sky-100 bg-white p-7 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-700 text-white">
            <Briefcase size={18} aria-hidden="true" />
          </span>
          <h1 className="text-xl font-bold text-slate-900">Welcome back</h1>
        </div>
        <form onSubmit={onSubmit} noValidate>
          <Field label="Email" name="email" type="email" value={email} onChange={setEmail} required autoComplete="email" />
          <Field label="Password" name="password" type="password" value={password} onChange={setPassword} required autoComplete="current-password" />
          <label className="mb-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-sky-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            />
            Keep me logged in
          </label>
          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" loading={busy}>{busy ? 'Logging in…' : 'Log in'}</Button>
        </form>

        <div className="my-4 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
        </div>
        <Button type="button" variant="subtle" className="w-full" loading={demoBusy} onClick={tryDemo}>
          {demoBusy ? 'Loading demo…' : 'Try the demo'}
        </Button>
        <p className="mt-2 text-center text-xs text-slate-400">No sign-up — explore a sample account</p>

        <p className="mt-5 text-sm text-slate-600">
          No account? <Link className="font-medium text-sky-700 hover:underline" to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
