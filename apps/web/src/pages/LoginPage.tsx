import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from '../components/BrandMark';

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
        className="hidden lg:flex flex-col justify-between p-10 text-white relative overflow-hidden"
        style={{ background: '#1c1c1c' }}
      >
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              'radial-gradient(circle at 12% 18%, rgba(115,19,255,0.4) 0%, transparent 42%), radial-gradient(circle at 88% 78%, rgba(36,213,246,0.32) 0%, transparent 40%), linear-gradient(160deg, #1c1c1c 0%, #1a1f3a 55%, #1c1c1c 100%)',
          }}
        />
        <div className="relative z-10 flex items-center gap-3">
          <BrandLogo variant="mark" height={40} />
          <div>
            <div className="text-base font-semibold tracking-tight">Agency Partner</div>
            <div className="text-[11px] tracking-[0.18em] uppercase text-[#5D4AFE]">Interactive</div>
          </div>
        </div>
        <div className="relative z-10">
          <h1 className="text-4xl font-semibold leading-tight max-w-md tracking-tight">
            Pre-sales estimation built for margin discipline.
          </h1>
          <p className="mt-4 max-w-md text-white/75">
            Price with confidence. Track labour, COGS, commission, and target margin before the
            proposal goes out.
          </p>
        </div>
        <div className="relative z-10 text-sm text-white/55">
          Unlock growth and value — internal profitability platform
        </div>
      </div>
      <div className="flex items-center justify-center p-8 bg-[var(--color-canvas)]">
        <form onSubmit={onSubmit} className="card w-full max-w-md p-8 space-y-5">
          <div className="space-y-4">
            <BrandLogo variant="full" height={36} />
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
              <p className="text-sm text-[var(--color-muted)] mt-1">
                Use a seeded demo account to explore.
              </p>
            </div>
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
