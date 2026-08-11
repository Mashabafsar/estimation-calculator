import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, money, pct } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MarginHealthBox } from '../components/MarginHealth';
import { PageLoader, Spinner } from '../components/Loader';

export function EstimateDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  async function load() {
    const data = await api(`/estimates/${id}`, { token });
    setEstimate(data);
  }

  useEffect(() => {
    setLoading(true);
    load()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id, token]);

  async function transition(action: string) {
    setBusy(true);
    try {
      await api(`/estimates/${id}/transition`, {
        method: 'POST',
        token,
        body: JSON.stringify({ action }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function markDeal(outcome: 'WON' | 'LOST') {
    setBusy(true);
    try {
      await api(`/estimates/${id}/deal`, {
        method: 'POST',
        token,
        body: JSON.stringify({ outcome }),
      });
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function exportCsv() {
    const csv = await api<string>(`/estimates/${id}/export?format=csv`, { token });
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${estimate.estimateNumber}.csv`;
    a.click();
  }

  if (loading || !estimate) return <PageLoader label="Loading estimate…" />;
  const calc = estimate.calculation;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/estimates" className="text-sm text-[var(--color-muted)]">
            ← Estimates
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{estimate.projectName}</h1>
          <p className="text-sm text-[var(--color-muted)]">
            {estimate.estimateNumber} · {estimate.client?.name ?? 'No client'} · v{estimate.currentVersion}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy && (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] mr-1">
              <Spinner /> Processing…
            </span>
          )}
          <button className="btn btn-ghost" disabled={busy} onClick={() => transition('SUBMIT')}>
            Submit Review
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => transition('APPROVE')}>
            Approve
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => transition('REJECT')}>
            Reject
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => markDeal('WON')}>
            Mark Won
          </button>
          <button className="btn btn-ghost" disabled={busy} onClick={() => markDeal('LOST')}>
            Mark Lost
          </button>
          <button className="btn btn-primary" disabled={busy} onClick={exportCsv}>
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="text-xs text-[var(--color-muted)]">Status</div>
          <div className="font-semibold mt-1">{estimate.status.replaceAll('_', ' ')}</div>
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--color-muted)]">Engagement Fee</div>
          <div className="font-semibold mt-1">{money(calc?.engagementFee)}</div>
          {calc && (
            <div className="text-[11px] text-[var(--color-muted)] mt-1">
              {Number(estimate.negotiatedPrice) > 0 ? '= Negotiated Price' : '= Labour Revenue'}
            </div>
          )}
        </div>
        <div className="card p-4">
          <div className="text-xs text-[var(--color-muted)]">Direct Margin</div>
          <div className="font-semibold mt-1">
            {money(calc?.directMargin)} ({pct(calc?.grossMarginPct)})
          </div>
        </div>
        <MarginHealthBox health={calc?.marginHealth} marginPct={calc?.grossMarginPct} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-line)] font-semibold">Resources</div>
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-2">Role</th>
                <th className="px-4 py-2">Loc</th>
                <th className="px-4 py-2">Hrs</th>
                <th className="px-4 py-2">Revenue</th>
                <th className="px-4 py-2">Cost</th>
              </tr>
            </thead>
            <tbody>
              {estimate.resources.map((r: any) => (
                <tr key={r.id} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-2">{r.roleName}</td>
                  <td className="px-4 py-2">{r.location}</td>
                  <td className="px-4 py-2">{Number(r.hours)}</td>
                  <td className="px-4 py-2">{money(r.totalRevenue)}</td>
                  <td className="px-4 py-2">{money(r.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-4 space-y-3">
          <div className="font-semibold">Proposal Mode</div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-[var(--color-muted)]">Negotiated</div>
              <div className="font-medium">{money(estimate.negotiatedPrice)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Recommended</div>
              <div className="font-medium">{money(calc?.recommendedPrice)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Discount %</div>
              <div className="font-medium">{pct(Number(calc?.discountPct || 0) * 100)}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Payment Terms</div>
              <div className="font-medium">{calc?.paymentTerms ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-muted)]">Warranty Period</div>
              <div className="font-medium">
                {estimate.warrantyMonths ?? calc?.warrantyMonths ?? 3} months
              </div>
            </div>
          </div>
          <div className="space-y-2">
            {(calc?.recommendations as any[] | undefined)?.map((r, i) => (
              <div key={i} className="rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-xs">
                {r.message}
              </div>
            ))}
          </div>
        </div>
      </div>

      {Array.isArray(calc?.departmentTotals) && calc.departmentTotals.length > 0 && (
        <>
          <div className="card p-4 h-80">
            <div className="text-sm font-semibold mb-1">Department Consumption</div>
            <p className="text-xs text-[var(--color-muted)] mb-2">Hours and cost by department</p>
            <ResponsiveContainer width="100%" height="85%">
              <BarChart data={calc.departmentTotals} margin={{ bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis
                  dataKey="department"
                  tick={{ fontSize: 11 }}
                  interval={0}
                  angle={-20}
                  textAnchor="end"
                  height={60}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) =>
                    name === 'hours'
                      ? [`${value}h`, 'Hours']
                      : [money(value), name === 'totalCost' ? 'Cost' : 'Revenue']
                  }
                />
                <Legend />
                <Bar yAxisId="left" dataKey="hours" name="Hours" fill="#0284c7" radius={[6, 6, 0, 0]} />
                <Bar
                  yAxisId="right"
                  dataKey="totalCost"
                  name="Cost"
                  fill="#0f766e"
                  radius={[6, 6, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-[var(--color-line)] font-semibold">
              Department Hours Totals
            </div>
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--color-muted)] bg-[var(--color-canvas)]">
                <tr>
                  <th className="px-4 py-2">Department</th>
                  <th className="px-4 py-2">Hours</th>
                  <th className="px-4 py-2">% Hours</th>
                  <th className="px-4 py-2">Total Cost</th>
                  <th className="px-4 py-2">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {calc.departmentTotals.map((d: any) => (
                  <tr key={d.department} className="border-t border-[var(--color-line)]">
                    <td className="px-4 py-2 font-medium">{d.department}</td>
                    <td className="px-4 py-2">{d.hours}</td>
                    <td className="px-4 py-2">{pct(d.pctOfHours)}</td>
                    <td className="px-4 py-2">{money(d.totalCost)}</td>
                    <td className="px-4 py-2">{money(d.totalRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {Array.isArray(calc?.sprintBreakdown) && calc.sprintBreakdown.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-line)] font-semibold">
            Sprint / Milestone Breakdown
            {calc?.sprintCount ? ` · ${calc.sprintCount} sprints × ${calc?.sprintWeeks ?? 2} weeks` : ''}
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)] bg-[var(--color-canvas)]">
              <tr>
                <th className="px-4 py-2">Milestone</th>
                <th className="px-4 py-2">%</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Hours</th>
              </tr>
            </thead>
            <tbody>
              {calc.sprintBreakdown.map((s: any) => (
                <tr key={s.order} className="border-t border-[var(--color-line)]">
                  <td className="px-4 py-2">{s.name}</td>
                  <td className="px-4 py-2">{pct(Number(s.percentage) * 100)}</td>
                  <td className="px-4 py-2">{money(s.amount)}</td>
                  <td className="px-4 py-2">{s.hours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <div className="font-semibold mb-3">Scenarios</div>
          <div className="space-y-2">
            {estimate.scenarios?.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-medium">
                    {s.name} {s.isWinner ? '★' : ''}
                  </div>
                  <div className="text-xs text-[var(--color-muted)]">{money(s.negotiatedPrice)}</div>
                </div>
              </div>
            ))}
            {!estimate.scenarios?.length && (
              <div className="text-sm text-[var(--color-muted)]">No scenarios yet.</div>
            )}
          </div>
        </div>
        <div className="card p-4">
          <div className="font-semibold mb-3">Version History</div>
          <div className="space-y-2">
            {estimate.versions?.map((v: any) => (
              <div key={v.id} className="rounded-lg border border-[var(--color-line)] px-3 py-2 text-sm">
                <div className="font-medium">Version {v.version}</div>
                <div className="text-xs text-[var(--color-muted)]">
                  {v.createdBy?.firstName} {v.createdBy?.lastName} ·{' '}
                  {new Date(v.createdAt).toLocaleString()}
                </div>
                <div className="text-xs mt-1">{v.changeSummary}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
