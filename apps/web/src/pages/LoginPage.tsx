import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, user, loading } = useAuth();
  const [email, setEmail] = useState('admin@estimation.local');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-full grid lg:grid-cols-2">
      <div
        className="hidden lg:flex flex-col justify-between p-10 text-white"
        style={{
          background:
            'radial-gradient(circle at 20% 20%, #14b8a6 0%, transparent 40%), linear-gradient(145deg, #0f172a 0%, #134e4a 55%, #0f766e 100%)',
        }}
      >
        <div className="text-sm font-semibold tracking-[0.2em] uppercase opacity-80">Estimation</div>
        <div>
          <h1 className="text-4xl font-semibold leading-tight max-w-md">
            Pre-sales estimation built for margin discipline.
          </h1>
          <p className="mt-4 max-w-md text-white/75">
            Price with confidence. Track labour, COGS, commission, and target margin before the proposal goes out.
          </p>
        </div>
        <div className="text-sm text-white/60">Internal profitability platform</div>
      </div>
      <div className="flex items-center justify-center p-8 bg-[var(--color-canvas)]">
        <form onSubmit={onSubmit} className="card w-full max-w-md p-8 space-y-5">
          <div>
            <h2 className="text-2xl font-semibold">Sign in</h2>
            <p className="text-sm text-[var(--color-muted)] mt-1">Use a seeded demo account to explore.</p>
          </div>
          {error && (
            <div className="rounded-lg bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-200 px-3 py-2 text-sm">
              {error}
            </div>
          )}
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Email</span>
            <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium">Password</span>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
          <p className="text-xs text-[var(--color-muted)]">
            Demo: admin@estimation.local / Password123!
          </p>
        </form>
      </div>
    </div>
  );
}
