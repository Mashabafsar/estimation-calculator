import { useEffect, useState } from 'react';
import { api, pct } from '../lib/api';
import { useAuth } from '../context/AuthContext';

export function TemplatesPage() {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);

  useEffect(() => {
    api<any[]>('/templates', { token }).then(setTemplates).catch(console.error);
  }, [token]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Service Templates</h1>
        <p className="text-sm text-[var(--color-muted)]">
          Default roles, hours, commission, and COGS rates from the Excel calculator.
        </p>
      </div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((t) => (
          <div key={t.id} className="card p-4 space-y-3">
            <div>
              <div className="font-semibold">{t.name}</div>
              <div className="text-xs text-[var(--color-muted)] mt-1">{t.description}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg bg-[var(--color-canvas)] p-2">
                Commission {pct(Number(t.commissionRate) * 100)}
              </div>
              <div className="rounded-lg bg-[var(--color-canvas)] p-2">
                COGS {pct(Number(t.cogsRate) * 100)}
              </div>
              <div className="rounded-lg bg-[var(--color-canvas)] p-2">
                Sub ${Number(t.defaultSubcontractor).toLocaleString()}
              </div>
              <div className="rounded-lg bg-[var(--color-canvas)] p-2">
                Roles {t.roles?.length ?? 0}
              </div>
            </div>
            <div className="text-xs text-[var(--color-muted)] space-y-1 max-h-28 overflow-auto">
              {t.roles?.slice(0, 6).map((r: any) => (
                <div key={r.id}>
                  {r.role.name} · {r.location} · {Number(r.defaultHours)}h
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
