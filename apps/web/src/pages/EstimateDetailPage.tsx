import { useEffect, useMemo, useState } from 'react';
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
import { EstimateFinancialResults } from '../components/EstimateFinancialResults';
import { PageLoader, Spinner } from '../components/Loader';

export function EstimateDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [exporting, setExporting] = useState(false);

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

  async function exportPdf() {
    setExporting(true);
    try {
      const blob = await api<Blob>(`/estimates/${id}/export?format=pdf`, { token });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${estimate.estimateNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const calc = estimate?.calculation;
  const raw = (calc?.rawBreakdown ?? {}) as any;
  const sprintTotalPct = useMemo(() => {
    const rows = Array.isArray(calc?.sprintBreakdown) ? calc.sprintBreakdown : [];
    return rows.reduce((s: number, r: any) => s + Number(r.percentage || 0), 0);
  }, [calc]);
  const sprintTotalAmt = useMemo(() => {
    const rows = Array.isArray(calc?.sprintBreakdown) ? calc.sprintBreakdown : [];
    return rows.reduce((s: number, r: any) => s + Number(r.amount || 0), 0);
  }, [calc]);
  const sprintTotalHrs = useMemo(() => {
    const rows = Array.isArray(calc?.sprintBreakdown) ? calc.sprintBreakdown : [];
    return rows.reduce((s: number, r: any) => s + Number(r.hours || 0), 0);
  }, [calc]);

  if (loading || !estimate) return <PageLoader label="Loading estimate…" />;

  const feeSource =
    Number(estimate.negotiatedPrice) > 0 || raw.engagementFeeSource === 'negotiated_price'
      ? 'negotiated_price'
      : 'labour_revenue';

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
          {(busy || exporting) && (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--color-muted)] mr-1">
              <Spinner /> {exporting ? 'Exporting…' : 'Processing…'}
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
          <button className="btn btn-primary" disabled={busy || exporting} onClick={exportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="card p-4">
              <div className="text-xs text-[var(--color-muted)]">Status</div>
              <div className="font-semibold mt-1">{estimate.status.replaceAll('_', ' ')}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-[var(--color-muted)]">Negotiated Price</div>
              <div className="font-semibold mt-1">{money(estimate.negotiatedPrice)}</div>
            </div>
            <div className="card p-4">
              <div className="text-xs text-[var(--color-muted)]">Warranty Period</div>
              <div className="font-semibold mt-1">
                {estimate.warrantyPeriodDays ?? raw.warrantyPeriodDays ?? 0} days
              </div>
            </div>
          </div>

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
                      <th className="px-4 py-2">Rate Cost</th>
                      <th className="px-4 py-2">Rate Bill</th>
                      <th className="px-4 py-2">Total Revenue</th>
                      <th className="px-4 py-2">Total Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calc.departmentTotals.map((d: any) => (
                      <tr key={d.department} className="border-t border-[var(--color-line)]">
                        <td className="px-4 py-2 font-medium">{d.department}</td>
                        <td className="px-4 py-2">{d.hours}</td>
                        <td className="px-4 py-2">{pct(d.pctOfHours)}</td>
                        <td className="px-4 py-2">${Number(d.hourlyCost).toFixed(2)}</td>
                        <td className="px-4 py-2">${Number(d.hourlyBilling).toFixed(2)}</td>
                        <td className="px-4 py-2">{money(d.totalRevenue)}</td>
                        <td className="px-4 py-2">{money(d.totalCost)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-[var(--color-line)] bg-[var(--color-canvas)] font-semibold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2">{Number(calc.totalHours)}</td>
                      <td className="px-4 py-2">100%</td>
                      <td className="px-4 py-2">
                        $
                        {(Number(calc.totalHours) > 0
                          ? Number(calc.labourCost) / Number(calc.totalHours)
                          : 0
                        ).toFixed(2)}
                      </td>
                      <td className="px-4 py-2">
                        $
                        {(Number(calc.totalHours) > 0
                          ? Number(calc.labourRevenue) / Number(calc.totalHours)
                          : 0
                        ).toFixed(2)}
                      </td>
                      <td className="px-4 py-2">{money(calc.labourRevenue)}</td>
                      <td className="px-4 py-2">{money(calc.labourCost)}</td>
                    </tr>
                  </tbody>
                </table>
                <div className="px-4 py-3 border-t border-[var(--color-line)] grid sm:grid-cols-2 gap-2 text-sm">
                  <div>
                    Commission <span className="font-semibold">{money(calc.salesCommission)}</span>
                  </div>
                  <div>
                    COGS <span className="font-semibold">{money(calc.cogs)}</span>
                  </div>
                  <div>
                    API Rate <span className="font-semibold">${Number(calc.apiRate).toFixed(0)}/hr</span>
                  </div>
                  <div>
                    Market Rate{' '}
                    <span className="font-semibold">${Number(calc.marketRate).toFixed(0)}/hr</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {calc ? (
          <EstimateFinancialResults
            calc={{
              ...calc,
              sprintCount: estimate.sprintCount ?? raw.sprintCount ?? calc.sprintCount,
              sprintWeeks: estimate.sprintWeeks ?? raw.sprintWeeks ?? calc.sprintWeeks ?? 2,
              engagementFeeSource: feeSource,
            }}
            sticky
          />
        ) : (
          <div className="card p-4 text-sm text-[var(--color-muted)]">No calculation saved yet.</div>
        )}
      </div>

      {Array.isArray(calc?.sprintBreakdown) && calc.sprintBreakdown.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-line)] flex flex-wrap items-start justify-between gap-2">
            <div className="font-semibold">
              Sprint / Milestone Breakdown
              {` (${estimate.sprintCount ?? raw.sprintCount ?? calc.sprintCount ?? 0} sprints × ${
                estimate.sprintWeeks ?? raw.sprintWeeks ?? 2
              } weeks)`}
            </div>
            <div
              className={`text-sm font-semibold ${
                Math.abs(sprintTotalPct - 1) < 0.001 ? 'text-emerald-600' : 'text-amber-600'
              }`}
            >
              Total {pct(sprintTotalPct * 100)}
              {Math.abs(sprintTotalPct - 1) >= 0.001 ? ' (should be 100%)' : ''}
            </div>
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
              <tr className="border-t border-[var(--color-line)] bg-[var(--color-canvas)] font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2">{pct(sprintTotalPct * 100)}</td>
                <td className="px-4 py-2">{money(sprintTotalAmt)}</td>
                <td className="px-4 py-2">{Math.round(sprintTotalHrs * 100) / 100}</td>
              </tr>
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
