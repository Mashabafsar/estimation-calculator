import { useEffect, useState } from 'react';
import { api, money } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function SettingsPage() {
  const { token, user } = useAuth();
  const [settings, setSettings] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      api<any[]>('/settings', { token }),
      api<any[]>('/roles?all=true', { token }),
      api<any[]>('/settings/payment-terms', { token }),
    ]).then(([s, r, p]) => {
      setSettings(s);
      setRoles(r);
      setPaymentTerms(p);
      setDraft(Object.fromEntries(s.map((x) => [x.key, x.value])));
    });
  }, [token]);

  async function saveSettings() {
    const updates = Object.entries(draft).map(([key, value]) => ({ key, value }));
    await api('/settings', {
      method: 'PUT',
      token,
      body: JSON.stringify({ updates }),
    });
    setMessage('Settings saved');
    setTimeout(() => setMessage(''), 2000);
  }

  const canEdit = user?.role === 'ADMIN' || user?.role === 'FINANCE';
  const grouped = settings.reduce<Record<string, any[]>>((acc, s) => {
    (acc[s.category] ||= []).push(s);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">
            Everything configurable — margins, rates, capacity, and payment terms.
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={saveSettings}>
            Save Settings
          </button>
        )}
      </div>
      {message && <div className="text-sm text-emerald-600">{message}</div>}

      <div className="grid lg:grid-cols-2 gap-4">
        {Object.entries(grouped).map(([category, rows]) => (
          <div key={category} className="card p-4 space-y-3">
            <h2 className="font-semibold capitalize">{category}</h2>
            {rows.map((s) => (
              <label key={s.key} className="block text-sm space-y-1">
                <span className="font-medium">{s.label || s.key}</span>
                <input
                  className="input"
                  disabled={!canEdit}
                  value={draft[s.key] ?? ''}
                  onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 font-semibold border-b border-[var(--color-line)]">Employee Roles & Rates</div>
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-2">Role</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Cost / hr</th>
              <th className="px-4 py-2">Bill / hr</th>
              <th className="px-4 py-2">Active</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((r) => (
              <tr key={r.id} className="border-t border-[var(--color-line)]">
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{r.defaultLocation}</td>
                <td className="px-4 py-2">{money(r.hourlyCostRate)}</td>
                <td className="px-4 py-2">{money(r.hourlyBillingRate)}</td>
                <td className="px-4 py-2">{r.isActive ? 'Yes' : 'No'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-3 font-semibold border-b border-[var(--color-line)]">Payment Terms</div>
        <table className="w-full text-sm">
          <thead className="text-left text-[var(--color-muted)]">
            <tr>
              <th className="px-4 py-2">Band</th>
              <th className="px-4 py-2">Warranty Days</th>
              <th className="px-4 py-2">Terms</th>
            </tr>
          </thead>
          <tbody>
            {paymentTerms.map((p) => (
              <tr key={p.id} className="border-t border-[var(--color-line)]">
                <td className="px-4 py-2">{p.label}</td>
                <td className="px-4 py-2">{p.warrantyDays}</td>
                <td className="px-4 py-2">{p.terms}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
