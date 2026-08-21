import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Line,
  LineChart,
} from 'recharts';
import { api, money, pct } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { MarginHealthLegend } from '../components/MarginHealth';
import { PageLoader } from '../components/Loader';

interface DashboardData {
  kpis: {
    totalEstimates: number;
    wonDeals: number;
    lostDeals: number;
    averageMargin: number;
    averageSellingPrice: number;
    revenuePipeline: number;
    monthlyEstimatedRevenue: number;
    marginDistribution: { green: number; yellow: number; red: number };
  };
  charts: {
    monthlyRevenue: Array<{ month: string; revenue: number }>;
    marginTrend: Array<{ month: string; marginPct: number }>;
    costBreakdown: { labour: number; commission: number; cogs: number; expenses: number };
    resourceBreakdown: Array<{ role: string; hours: number; cost?: number; revenue?: number }>;
    departmentConsumption: Array<{ role: string; hours: number; cost: number; revenue: number }>;
    dealStatus: Array<{ status: string; count: number }>;
  };
}

const COLORS = ['#4D71FB', '#24D5F6', '#8565FC', '#e11d48', '#f59e0b', '#6b7280'];

function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-[var(--color-muted)] font-semibold">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-[var(--color-muted)]">{hint}</div>}
    </div>
  );
}

function shareOfTotal(count: number, total: number) {
  if (!total) return '0% of total';
  return `${pct((count / total) * 100, 0)} of total`;
}

export function DashboardPage() {
  const { token } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api<DashboardData>('/dashboard', { token })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading || !data) return <PageLoader label="Loading dashboard…" />;

  const total = data.kpis.totalEstimates;
  const costData = Object.entries(data.charts.costBreakdown).map(([name, value]) => ({ name, value }));
  const marginPie = [
    { name: 'Green ≥50%', value: data.kpis.marginDistribution.green, color: '#047857' },
    { name: 'Yellow 40–50%', value: data.kpis.marginDistribution.yellow, color: '#b45309' },
    { name: 'Red <40%', value: data.kpis.marginDistribution.red, color: '#be123c' },
  ];
  const deptData =
    data.charts.departmentConsumption?.length
      ? data.charts.departmentConsumption
      : data.charts.resourceBreakdown.map((r) => ({
          role: r.role,
          hours: r.hours,
          cost: r.cost ?? 0,
          revenue: r.revenue ?? 0,
        }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Pipeline health, margins, and resource load.</p>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <Kpi label="Total Estimates" value={String(total)} />
        <Kpi
          label="Won"
          value={`${data.kpis.wonDeals} / ${total}`}
          hint={shareOfTotal(data.kpis.wonDeals, total)}
        />
        <Kpi
          label="Lost"
          value={`${data.kpis.lostDeals} / ${total}`}
          hint={shareOfTotal(data.kpis.lostDeals, total)}
        />
        <Kpi
          label="Average Margin"
          value={pct(data.kpis.averageMargin)}
          hint="Average gross profit margin %"
        />
        <Kpi label="Revenue Pipeline" value={money(data.kpis.revenuePipeline)} />
        <Kpi label="Avg Selling Price" value={money(data.kpis.averageSellingPrice)} />
      </div>

      <div className="card p-4 space-y-3">
        <div className="text-sm font-semibold">Margin Health Overview</div>
        <MarginHealthLegend distribution={data.kpis.marginDistribution} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="card p-4 h-80">
          <div className="text-sm font-semibold mb-3">Monthly Revenue</div>
          <ResponsiveContainer width="100%" height="90%">
            <BarChart data={data.charts.monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Bar dataKey="revenue" fill="#4D71FB" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4 h-80">
          <div className="text-sm font-semibold mb-3">Margin %</div>
          <ResponsiveContainer width="100%" height="90%">
            <LineChart data={data.charts.marginTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="marginPct" stroke="#24D5F6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4 h-80">
          <div className="text-sm font-semibold mb-3">Cost Breakdown</div>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={costData} dataKey="value" nameKey="name" outerRadius={90} label>
                {costData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4 h-80">
          <div className="text-sm font-semibold mb-3">Margin Health Mix</div>
          <ResponsiveContainer width="100%" height="90%">
            <PieChart>
              <Pie data={marginPie} dataKey="value" nameKey="name" outerRadius={90} label>
                {marginPie.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-4 h-[26rem] lg:col-span-2">
          <div className="text-sm font-semibold mb-1">Department Consumption</div>
          <p className="text-xs text-[var(--color-muted)] mb-3">
            Hours and cost across all selected departments in active estimates.
          </p>
          <ResponsiveContainer width="100%" height="85%">
            <BarChart data={deptData} margin={{ bottom: 48 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
              <XAxis
                dataKey="role"
                tick={{ fontSize: 11 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={70}
              />
              <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number, name: string) =>
                  name === 'hours' ? [`${value}h`, 'Hours'] : [money(value), name === 'cost' ? 'Cost' : 'Revenue']
                }
              />
              <Legend />
              <Bar yAxisId="left" dataKey="hours" name="Hours" fill="#4D71FB" radius={[6, 6, 0, 0]} />
              <Bar yAxisId="right" dataKey="cost" name="Cost" fill="#8565FC" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
