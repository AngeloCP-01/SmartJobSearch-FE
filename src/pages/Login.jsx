import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import Field from '../components/Field';
import Button from '../components/Button';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login({ email, password });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setBusy(false);
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
          {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</Button>
        </form>
        <p className="mt-5 text-sm text-slate-600">
          No account? <Link className="font-medium text-sky-700 hover:underline" to="/register">Create one</Link>
        </p>
      </div>
    </div>
  );
}
