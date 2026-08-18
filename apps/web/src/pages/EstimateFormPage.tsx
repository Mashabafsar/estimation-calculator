import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { ButtonLoader } from '../components/Loader';

interface Role {
  id: string;
  name: string;
  hourlyCostRate: string;
  hourlyBillingRate: string;
  defaultLocation: 'ONSHORE' | 'OFFSHORE';
}

interface Template {
  id: string;
  name: string;
  commissionRate: string;
  cogsRate: string;
  defaultSubcontractor: string;
  defaultDevServerCost: string;
  defaultSprintCount?: number;
  defaultSprintWeeks?: number;
  roles: Array<{
    location: 'ONSHORE' | 'OFFSHORE';
    defaultHours: string;
    billRateOverride?: string | null;
    costRateOverride?: string | null;
    role: Role;
  }>;
}

interface Client {
  id: string;
  name: string;
}

interface CalcResult {
  engagementFee: number;
  directCosts: number;
  directMargin: number;
  grossMarginPct: number;
  recommendedPrice: number;
  excessDeficit: number;
  marginHealth: string;
  salesCommission: number;
  cogs: number;
  labourCost: number;
  labourRevenue: number;
  totalHours: number;
  marketRate: number;
  apiRate: number;
  paymentTerms: string | null;
  recommendations: Array<{ message: string; amount?: number }>;
  departmentTotals: Array<{
    department: string;
    hours: number;
    hourlyCost: number;
    hourlyBilling: number;
    totalCost: number;
    totalRevenue: number;
    pctOfHours: number;
  }>;
  sprintBreakdown: Array<{
    name: string;
    order: number;
    percentage: number;
    amount: number;
    hours: number;
    weeks?: number;
    departmentHours: Array<{ department: string; hours: number; cost: number; revenue: number }>;
  }>;
  sprintCount: number;
  sprintWeeks: number;
  sprintFormula?: string;
  warrantyPeriodDays?: number;
  engagementFeeSource?: 'negotiated_price' | 'labour_revenue';
  targetMarginPct?: number;
  targetMarginAmount?: number;
}

type FormValues = {
  projectName: string;
  description: string;
  clientId: string;
  templateId: string;
  complexity: string;
  negotiatedPrice: number | '';
  warrantyPeriodDays: number;
  resources: Array<{
    roleId: string;
    roleName: string;
    location: 'ONSHORE' | 'OFFSHORE';
    hours: number;
    hourlyCost: number;
    hourlyBilling: number;
  }>;
  expenses: Array<{
    category: string;
    name: string;
    amount: number;
    isRecurring: boolean;
  }>;
};

type PaymentPlanRow = { name: string; percentage: number };

export function EstimateFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [expandedSprint, setExpandedSprint] = useState<number | null>(null);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [paymentPlan, setPaymentPlan] = useState<PaymentPlanRow[]>([]);
  const [planDirty, setPlanDirty] = useState(false);

  const { register, control, watch, setValue, handleSubmit, getValues } = useForm<FormValues>({
    defaultValues: {
      projectName: '',
      description: '',
      clientId: '',
      templateId: '',
      complexity: 'MEDIUM',
      negotiatedPrice: '',
      warrantyPeriodDays: 0,
      resources: [],
      expenses: [],
    },
  });

  const resources = useFieldArray({ control, name: 'resources' });
  const expenses = useFieldArray({ control, name: 'expenses' });
  const templateId = watch('templateId');
  const negotiatedPrice = watch('negotiatedPrice');
  const warrantyPeriodDays = watch('warrantyPeriodDays');

  useEffect(() => {
    setPlanDirty(false);
  }, [warrantyPeriodDays]);

  useEffect(() => {
    if (!calc?.sprintBreakdown?.length) return;
    if (planDirty && paymentPlan.length) return;
    setPaymentPlan(calc.sprintBreakdown.map((s) => ({ name: s.name, percentage: s.percentage })));
  }, [calc]);

  useEffect(() => {
    Promise.all([
      api<Template[]>('/templates', { token }),
      api<Client[]>('/clients', { token }),
      api<Role[]>('/roles', { token }),
    ]).then(([t, c, r]) => {
      setTemplates(t);
      setClients(c);
      setRoles(r);
    });
  }, [token]);

  useEffect(() => {
    if (!templateId) return;
    const tpl = templates.find((t) => t.id === templateId);
    if (!tpl) return;
    resources.replace(
      tpl.roles.map((tr) => ({
        roleId: tr.role.id,
        roleName: tr.role.name,
        location: tr.location,
        hours: Number(tr.defaultHours) || 0,
        hourlyCost: Number(tr.costRateOverride ?? tr.role.hourlyCostRate),
        hourlyBilling: Number(tr.billRateOverride ?? tr.role.hourlyBillingRate),
      })),
    );
    expenses.replace([
      {
        category: 'SUBCONTRACTOR',
        name: 'Sub-Contractor',
        amount: Number(tpl.defaultSubcontractor) || 0,
        isRecurring: false,
      },
      {
        category: 'DEV_SERVER',
        name: 'Dev Server Cost',
        amount: Number(tpl.defaultDevServerCost) || 0,
        isRecurring: true,
      },
    ]);
  }, [templateId, templates]);

  async function onUploadSource(file: File) {
    setUploading(true);
    setUploadMsg('');
    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const contentBase64 = btoa(binary);

      const parsed = await api<{
        projectTitle: string | null;
        departments: Array<{
          name: string;
          hours: number;
          roleId?: string;
          roleName?: string;
          location?: 'ONSHORE' | 'OFFSHORE';
          hourlyCost?: number;
          hourlyBilling?: number;
          matched: boolean;
        }>;
        totalHours: number;
        warnings: string[];
      }>('/estimates/parse-source', {
        method: 'POST',
        token,
        body: JSON.stringify({ fileName: file.name, contentBase64 }),
      });

      if (parsed.projectTitle && !getValues('projectName')) {
        const title = parsed.projectTitle.split('\n')[0].trim();
        setValue('projectName', title);
      }

      const mapped = parsed.departments.map((d) => {
          const role =
            roles.find((r) => r.id === d.roleId) ||
            roles.find((r) => r.name === d.roleName) ||
            roles.find((r) => r.name.toLowerCase().includes(d.name.toLowerCase())) ||
            roles.find((r) => d.name.toLowerCase().includes(r.name.toLowerCase().split(' ')[0]));
          return {
            roleId: role?.id || d.roleId || roles[0]?.id || '',
            roleName: role?.name || d.roleName || d.name,
            location: (d.location || role?.defaultLocation || 'OFFSHORE') as 'ONSHORE' | 'OFFSHORE',
            hours: d.hours,
            hourlyCost: Number(d.hourlyCost ?? role?.hourlyCostRate ?? 0),
            hourlyBilling: Number(d.hourlyBilling ?? role?.hourlyBillingRate ?? 0),
          };
        });

      if (!mapped.length) {
        setUploadMsg('No department columns found in the file.');
        return;
      }

      resources.replace(mapped);
      setPlanDirty(false);
      setPaymentPlan([]);
      setUploadMsg(
        `Loaded ${mapped.length} departments · ${parsed.totalHours}h` +
          (parsed.warnings?.length ? ` · ${parsed.warnings.join('; ')}` : ''),
      );
      setCalc(null);
    } catch (e: any) {
      setUploadMsg(e.message || 'Failed to parse file');
    } finally {
      setUploading(false);
    }
  }

  function buildPayload(values: FormValues) {
    const days = Number(values.warrantyPeriodDays);
    return {
      ...values,
      negotiatedPrice: values.negotiatedPrice === '' ? null : Number(values.negotiatedPrice),
      warrantyPeriodDays: Number.isFinite(days) ? days : 0,
      clientId: values.clientId || undefined,
      templateId: values.templateId || undefined,
      sprintPaymentPlan:
        planDirty && paymentPlan.length
          ? paymentPlan.map((p) => ({
              name: p.name,
              percentage: Number(p.percentage) || 0,
            }))
          : undefined,
    };
  }

  async function preview() {
    setCalculating(true);
    try {
      const payload = buildPayload(getValues());
      const result = await api<CalcResult>('/estimates/preview', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
      setCalc(result);
      if (!planDirty) {
        setPaymentPlan(result.sprintBreakdown.map((s) => ({ name: s.name, percentage: s.percentage })));
      }
    } finally {
      setCalculating(false);
    }
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const estimate = await api<{ id: string }>('/estimates', {
        method: 'POST',
        token,
        body: JSON.stringify(buildPayload(values)),
      });
      navigate(`/estimates/${estimate.id}`);
    } finally {
      setSaving(false);
    }
  }

  function updatePaymentPct(index: number, displayPct: string) {
    const n = Number(displayPct);
    setPlanDirty(true);
    setPaymentPlan((prev) =>
      prev.map((row, i) =>
        i === index
          ? { ...row, percentage: Number.isFinite(n) ? Math.max(0, n) / 100 : 0 }
          : row,
      ),
    );
  }

  const paymentTotalPct = useMemo(
    () => paymentPlan.reduce((s, p) => s + (Number(p.percentage) || 0), 0),
    [paymentPlan],
  );

  const paymentRows = useMemo(() => {
    if (!calc) return [];
    return paymentPlan.map((p, order) => ({
      name: p.name,
      order,
      percentage: p.percentage,
      amount: Math.round(calc.engagementFee * p.percentage * 100) / 100,
      hours: Math.round(calc.totalHours * p.percentage * 100) / 100,
      departmentHours: calc.sprintBreakdown[order]?.departmentHours ?? [],
    }));
  }, [calc, paymentPlan]);

  const avgRateCost = calc && calc.totalHours > 0 ? calc.labourCost / calc.totalHours : 0;
  const avgRateBill = calc && calc.totalHours > 0 ? calc.labourRevenue / calc.totalHours : 0;

  const healthColor = useMemo(() => {
    if (!calc) return '';
    if (calc.marginHealth === 'GREEN') return 'text-emerald-600';
    if (calc.marginHealth === 'YELLOW') return 'text-amber-600';
    return 'text-rose-600';
  }, [calc]);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">New Estimate</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Upload a Hours Breakdown workbook or pick a template. Target margin defaults to 50%.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={preview}
            disabled={calculating || saving || uploading}
          >
            {calculating ? <ButtonLoader label="Calculating…" /> : 'Calculate'}
          </button>
          <button className="btn btn-primary" disabled={saving || calculating || uploading}>
            {saving ? <ButtonLoader label="Saving…" /> : 'Save Estimate'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-semibold">Hours Source (Excel)</h2>
                <p className="text-xs text-[var(--color-muted)] mt-0.5">
                  Upload Boxer-style Hours Breakdown (.xlsx). Departments & hours are loaded and remain editable.
                </p>
              </div>
              <label className={`btn btn-ghost cursor-pointer ${uploading ? 'opacity-65 pointer-events-none' : ''}`}>
                {uploading ? <ButtonLoader label="Parsing…" /> : 'Upload .xlsx'}
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onUploadSource(f);
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
            {uploadMsg && <div className="text-xs text-[var(--color-accent)]">{uploadMsg}</div>}
          </div>

          <div className="card p-4 grid sm:grid-cols-2 gap-3">
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="font-medium">Project Name</span>
              <input className="input" {...register('projectName', { required: true })} />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Client</span>
              <select className="input" {...register('clientId')}>
                <option value="">Select client</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Service Template</span>
              <select className="input" {...register('templateId')}>
                <option value="">Select template (optional)</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Complexity</span>
              <select className="input" {...register('complexity')}>
                {['LOW', 'MEDIUM', 'HIGH', 'ENTERPRISE'].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Negotiated Price</span>
              <input
                className="input"
                type="number"
                step="0.01"
                {...register('negotiatedPrice', { valueAsNumber: true })}
              />
              <span className="text-[11px] text-[var(--color-muted)]">
                {negotiatedPrice !== '' && Number(negotiatedPrice) > 0
                  ? 'Engagement Fee will equal this Negotiated Price'
                  : 'Leave empty → Engagement Fee = Labour Revenue (billable hours)'}
              </span>
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Warranty Period (days)</span>
              <input
                className="input"
                type="number"
                min={0}
                max={730}
                step={1}
                {...register('warrantyPeriodDays', { valueAsNumber: true })}
              />
              <span className="text-[11px] text-[var(--color-muted)]">
                Default 0 · {Number(warrantyPeriodDays) || 0} days →{' '}
                {Math.ceil((Number(warrantyPeriodDays) || 0) / 30) || 0} × 1% warranty hold
                {Number(warrantyPeriodDays) > 0
                  ? ` (${(Math.ceil((Number(warrantyPeriodDays) || 0) / 30) || 0).toFixed(0)}%)`
                  : ''}
              </span>
            </label>
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="font-medium">Description</span>
              <textarea className="input min-h-20" {...register('description')} />
            </label>
            <div className="sm:col-span-2 rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-xs text-[var(--color-muted)]">
              Target margin: <strong className="text-[var(--color-ink)]">50%</strong> · Advance
              payment: <strong className="text-[var(--color-ink)]">30%</strong> · Sprint weeks fixed
              at <strong className="text-[var(--color-ink)]">2</strong> · Sprint count
              auto-calculated from heaviest department hours
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Resource Planning (Departments)</h2>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const role = roles[0];
                  if (!role) return;
                  resources.append({
                    roleId: role.id,
                    roleName: role.name,
                    location: role.defaultLocation,
                    hours: 0,
                    hourlyCost: Number(role.hourlyCostRate),
                    hourlyBilling: Number(role.hourlyBillingRate),
                  });
                }}
              >
                Add Resource
              </button>
            </div>
            <div className="space-y-2">
              {resources.fields.map((field, index) => (
                <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                  <label className="col-span-4 text-xs space-y-1">
                    <span>Department / Role</span>
                    <select
                      className="input"
                      {...register(`resources.${index}.roleId`)}
                      onChange={(e) => {
                        const role = roles.find((r) => r.id === e.target.value);
                        setValue(`resources.${index}.roleId`, e.target.value);
                        if (role) {
                          setValue(`resources.${index}.roleName`, role.name);
                          setValue(`resources.${index}.hourlyCost`, Number(role.hourlyCostRate));
                          setValue(`resources.${index}.hourlyBilling`, Number(role.hourlyBillingRate));
                          setValue(`resources.${index}.location`, role.defaultLocation);
                        }
                      }}
                    >
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                    <input type="hidden" {...register(`resources.${index}.roleName`)} />
                  </label>
                  <label className="col-span-2 text-xs space-y-1">
                    <span>Location</span>
                    <select className="input" {...register(`resources.${index}.location`)}>
                      <option value="ONSHORE">Onshore</option>
                      <option value="OFFSHORE">Offshore</option>
                    </select>
                  </label>
                  <label className="col-span-2 text-xs space-y-1">
                    <span>Hours</span>
                    <input
                      className="input"
                      type="number"
                      step="0.5"
                      {...register(`resources.${index}.hours`, { valueAsNumber: true })}
                    />
                  </label>
                  <label className="col-span-1 text-xs space-y-1">
                    <span>Cost</span>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      {...register(`resources.${index}.hourlyCost`, { valueAsNumber: true })}
                    />
                  </label>
                  <label className="col-span-2 text-xs space-y-1">
                    <span>Billing</span>
                    <input
                      className="input"
                      type="number"
                      step="0.01"
                      {...register(`resources.${index}.hourlyBilling`, { valueAsNumber: true })}
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost col-span-1"
                    onClick={() => resources.remove(index)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Additional Costs</h2>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() =>
                  expenses.append({
                    category: 'OTHER',
                    name: 'Miscellaneous',
                    amount: 0,
                    isRecurring: false,
                  })
                }
              >
                Add Expense
              </button>
            </div>
            {expenses.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <label className="col-span-3 text-xs space-y-1">
                  <span>Category</span>
                  <select className="input" {...register(`expenses.${index}.category`)}>
                    {[
                      'HOSTING',
                      'INFRASTRUCTURE',
                      'AWS',
                      'AZURE',
                      'GCP',
                      'THIRD_PARTY_API',
                      'LICENSE',
                      'SUBCONTRACTOR',
                      'DEV_SERVER',
                      'TRAVEL',
                      'MARKETING',
                      'LEGAL',
                      'COMPLIANCE',
                      'SECURITY',
                      'MISCELLANEOUS',
                      'OTHER',
                    ].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-4 text-xs space-y-1">
                  <span>Name</span>
                  <input className="input" {...register(`expenses.${index}.name`)} />
                </label>
                <label className="col-span-3 text-xs space-y-1">
                  <span>Amount</span>
                  <input
                    className="input"
                    type="number"
                    step="0.01"
                    {...register(`expenses.${index}.amount`, { valueAsNumber: true })}
                  />
                </label>
                <label className="col-span-1 text-xs space-y-1 flex items-center gap-1 pb-2">
                  <input type="checkbox" {...register(`expenses.${index}.isRecurring`)} />
                  Recurring
                </label>
                <button
                  type="button"
                  className="btn btn-ghost col-span-1"
                  onClick={() => expenses.remove(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {calc?.departmentTotals?.length ? (
            <>
              <div className="card p-4 h-72">
                <div className="text-sm font-semibold mb-1">Department Consumption</div>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={calc.departmentTotals} margin={{ bottom: 36 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                    <XAxis
                      dataKey="department"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      angle={-20}
                      textAnchor="end"
                      height={55}
                    />
                    <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value: number, name: string) =>
                        name === 'hours'
                          ? [`${value}h`, 'Hours']
                          : [money(value), name === 'totalCost' ? 'Cost' : 'Revenue']
                      }
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="hours" name="Hours" fill="#0284c7" radius={[4, 4, 0, 0]} />
                    <Bar
                      yAxisId="right"
                      dataKey="totalCost"
                      name="Cost"
                      fill="#0f766e"
                      radius={[4, 4, 0, 0]}
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
                    {calc.departmentTotals.map((d) => (
                      <tr key={d.department} className="border-t border-[var(--color-line)]">
                        <td className="px-4 py-2 font-medium">{d.department}</td>
                        <td className="px-4 py-2">{d.hours}</td>
                        <td className="px-4 py-2">{pct(d.pctOfHours)}</td>
                        <td className="px-4 py-2">${d.hourlyCost.toFixed(2)}</td>
                        <td className="px-4 py-2">${d.hourlyBilling.toFixed(2)}</td>
                        <td className="px-4 py-2">{money(d.totalRevenue)}</td>
                        <td className="px-4 py-2">{money(d.totalCost)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-[var(--color-line)] bg-[var(--color-canvas)] font-semibold">
                      <td className="px-4 py-2">Total</td>
                      <td className="px-4 py-2">{calc.totalHours}</td>
                      <td className="px-4 py-2">100%</td>
                      <td className="px-4 py-2">${avgRateCost.toFixed(2)}</td>
                      <td className="px-4 py-2">${avgRateBill.toFixed(2)}</td>
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
                    API Rate <span className="font-semibold">${calc.apiRate.toFixed(0)}/hr</span>
                  </div>
                  <div>
                    Market Rate <span className="font-semibold">${calc.marketRate.toFixed(0)}/hr</span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-3 sticky top-4">
            <h2 className="font-semibold">Financial Results</h2>
            {calculating && (
              <div className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
                <ButtonLoader label="Calculating…" />
              </div>
            )}
            {!calc && !calculating && (
              <p className="text-sm text-[var(--color-muted)]">
                Click Calculate to run the backend engine against current inputs.
              </p>
            )}
            {calc && !calculating && (
              <>
                <MarginHealthBox
                  health={calc.marginHealth}
                  marginPct={calc.grossMarginPct}
                  className="mb-1"
                />

                <div className="rounded-lg border border-[var(--color-line)] overflow-hidden text-sm">
                  <div className="bg-[var(--color-canvas)] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                    Comparison
                  </div>
                  <div className="divide-y divide-[var(--color-line)]">
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
                      <div>
                        <div className="text-[11px] text-[var(--color-muted)]">Engagement Fee</div>
                        <div className="font-semibold">{money(calc.engagementFee)}</div>
                      </div>
                      <div className="text-[var(--color-muted)] text-xs">vs</div>
                      <div className="text-right">
                        <div className="text-[11px] text-[var(--color-muted)]">Recommended @ 50%</div>
                        <div className="font-semibold">{money(calc.recommendedPrice)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
                      <div>
                        <div className="text-[11px] text-[var(--color-muted)]">Current Margin</div>
                        <div className={`font-semibold ${healthColor}`}>{pct(calc.grossMarginPct)}</div>
                      </div>
                      <div className="text-[var(--color-muted)] text-xs">vs</div>
                      <div className="text-right">
                        <div className="text-[11px] text-[var(--color-muted)]">Target Margin</div>
                        <div className="font-semibold">50%</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
                      <div>
                        <div className="text-[11px] text-[var(--color-muted)]">Labour Revenue</div>
                        <div className="font-semibold">{money(calc.labourRevenue)}</div>
                      </div>
                      <div className="text-[var(--color-muted)] text-xs">vs</div>
                      <div className="text-right">
                        <div className="text-[11px] text-[var(--color-muted)]">Labour Cost</div>
                        <div className="font-semibold">{money(calc.labourCost)}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center px-3 py-2">
                      <div>
                        <div className="text-[11px] text-[var(--color-muted)]">Fee − Direct Costs</div>
                        <div className={`font-semibold ${healthColor}`}>{money(calc.directMargin)}</div>
                      </div>
                      <div className="text-[var(--color-muted)] text-xs">vs</div>
                      <div className="text-right">
                        <div className="text-[11px] text-[var(--color-muted)]">Target Profit $</div>
                        <div className="font-semibold">
                          {money(calc.targetMarginAmount ?? calc.engagementFee * 0.5)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Direct Costs</div>
                    <div className="font-semibold text-lg">{money(calc.directCosts)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Excess / Deficit</div>
                    <div className="font-semibold text-lg">{money(calc.excessDeficit)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Total Hours</div>
                    <div className="font-semibold">{calc.totalHours}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Auto Sprints</div>
                    <div className="font-semibold">
                      {calc.sprintCount} × {calc.sprintWeeks}w
                    </div>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-muted)] border-t border-[var(--color-line)] pt-3">
                  Payment Terms: {calc.paymentTerms ?? '—'} · Fee source:{' '}
                  {calc.engagementFeeSource === 'negotiated_price' ? 'Negotiated Price' : 'Labour Revenue'}
                </div>
                <div className="space-y-2">
                  {calc.recommendations.map((r, i) => (
                    <div key={i} className="rounded-lg bg-[var(--color-canvas)] px-3 py-2 text-xs">
                      {r.message}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {calc && paymentRows.length > 0 && !calculating ? (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--color-line)] flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="font-semibold">
                Sprint / Milestone Breakdown ({calc.sprintCount} sprints × {calc.sprintWeeks} weeks)
              </div>
              {calc.sprintFormula && (
                <div className="text-xs text-[var(--color-muted)] mt-1 font-mono">{calc.sprintFormula}</div>
              )}
              <div className="text-xs text-[var(--color-muted)] mt-1">
                Edit payment % below. Amounts update live. Click Calculate again to persist edits in the engine.
              </div>
            </div>
            <div
              className={`text-sm font-semibold ${
                Math.abs(paymentTotalPct - 1) < 0.001
                  ? 'text-emerald-600'
                  : 'text-amber-600'
              }`}
            >
              Total {pct(paymentTotalPct * 100)}
              {Math.abs(paymentTotalPct - 1) >= 0.001 ? ' (should be 100%)' : ''}
            </div>
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--color-muted)] bg-[var(--color-canvas)]">
              <tr>
                <th className="px-4 py-2">Milestone</th>
                <th className="px-4 py-2 w-28">%</th>
                <th className="px-4 py-2">Amount</th>
                <th className="px-4 py-2">Hours</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {paymentRows.map((s) => (
                <Fragment key={s.order}>
                  <tr className="border-t border-[var(--color-line)]">
                    <td className="px-4 py-2">{s.name}</td>
                    <td className="px-4 py-2">
                      <input
                        className="input py-1"
                        type="number"
                        min={0}
                        max={100}
                        step={0.01}
                        value={Number((s.percentage * 100).toFixed(4))}
                        onChange={(e) => updatePaymentPct(s.order, e.target.value)}
                      />
                    </td>
                    <td className="px-4 py-2">{money(s.amount)}</td>
                    <td className="px-4 py-2">{s.hours}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="text-xs text-[var(--color-accent)]"
                        onClick={() =>
                          setExpandedSprint(expandedSprint === s.order ? null : s.order)
                        }
                      >
                        {expandedSprint === s.order ? 'Hide depts' : 'Depts'}
                      </button>
                    </td>
                  </tr>
                  {expandedSprint === s.order &&
                    s.departmentHours
                      .filter((d) => d.hours > 0)
                      .map((d) => (
                        <tr
                          key={`${s.order}-${d.department}`}
                          className="bg-[var(--color-canvas)] text-xs text-[var(--color-muted)]"
                        >
                          <td className="px-8 py-1">{d.department}</td>
                          <td className="px-4 py-1" />
                          <td className="px-4 py-1">{money(d.revenue)}</td>
                          <td className="px-4 py-1">{d.hours}h</td>
                          <td />
                        </tr>
                      ))}
                </Fragment>
              ))}
              <tr className="border-t border-[var(--color-line)] bg-[var(--color-canvas)] font-semibold">
                <td className="px-4 py-2">Total</td>
                <td className="px-4 py-2">{pct(paymentTotalPct * 100)}</td>
                <td className="px-4 py-2">
                  {money(paymentRows.reduce((s, r) => s + r.amount, 0))}
                </td>
                <td className="px-4 py-2">
                  {Math.round(paymentRows.reduce((s, r) => s + r.hours, 0) * 100) / 100}
                </td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
      ) : null}
    </form>
  );
}
