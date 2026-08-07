import { Fragment, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { api, money, pct } from '../lib/api';
import { useAuth } from '../context/AuthContext';

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
}

type FormValues = {
  projectName: string;
  description: string;
  clientId: string;
  templateId: string;
  complexity: string;
  negotiatedPrice: number | '';
  startDate: string;
  expectedDelivery: string;
  sprintCount: number;
  sprintWeeks: number;
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

export function EstimateFormPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [calc, setCalc] = useState<CalcResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedSprint, setExpandedSprint] = useState<number | null>(null);

  const { register, control, watch, setValue, handleSubmit, getValues } = useForm<FormValues>({
    defaultValues: {
      projectName: '',
      description: '',
      clientId: '',
      templateId: '',
      complexity: 'MEDIUM',
      negotiatedPrice: '',
      startDate: '',
      expectedDelivery: '',
      sprintCount: 10,
      sprintWeeks: 2,
      resources: [],
      expenses: [],
    },
  });

  const resources = useFieldArray({ control, name: 'resources' });
  const expenses = useFieldArray({ control, name: 'expenses' });
  const templateId = watch('templateId');

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
    setValue('sprintCount', tpl.defaultSprintCount ?? 10);
    setValue('sprintWeeks', tpl.defaultSprintWeeks ?? 2);
  }, [templateId, templates]);

  async function preview() {
    const values = getValues();
    const payload = {
      ...values,
      negotiatedPrice: values.negotiatedPrice === '' ? null : Number(values.negotiatedPrice),
      clientId: values.clientId || undefined,
      templateId: values.templateId || undefined,
    };
    const result = await api<CalcResult>('/estimates/preview', {
      method: 'POST',
      token,
      body: JSON.stringify(payload),
    });
    setCalc(result);
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const payload = {
        ...values,
        negotiatedPrice: values.negotiatedPrice === '' ? null : Number(values.negotiatedPrice),
        clientId: values.clientId || undefined,
        templateId: values.templateId || undefined,
      };
      const estimate = await api<{ id: string }>('/estimates', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      });
      navigate(`/estimates/${estimate.id}`);
    } finally {
      setSaving(false);
    }
  }

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
            Department hour totals and sprint breakdown are calculated on the backend.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn btn-ghost" onClick={preview}>
            Calculate
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Estimate'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
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
                <option value="">Select template</option>
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
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Start Date</span>
              <input className="input" type="date" {...register('startDate')} />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Expected Delivery</span>
              <input className="input" type="date" {...register('expectedDelivery')} />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Sprint Count</span>
              <input
                className="input"
                type="number"
                min={1}
                max={30}
                {...register('sprintCount', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Sprint Weeks</span>
              <input
                className="input"
                type="number"
                min={1}
                max={8}
                {...register('sprintWeeks', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="font-medium">Description</span>
              <textarea className="input min-h-20" {...register('description')} />
            </label>
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
                    <th className="px-4 py-2">Avg Cost</th>
                    <th className="px-4 py-2">Avg Bill</th>
                    <th className="px-4 py-2">Total Cost</th>
                    <th className="px-4 py-2">Total Revenue</th>
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
                      <td className="px-4 py-2">{money(d.totalCost)}</td>
                      <td className="px-4 py-2">{money(d.totalRevenue)}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-[var(--color-line)] bg-[var(--color-canvas)] font-semibold">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2">{calc.totalHours}</td>
                    <td className="px-4 py-2">100%</td>
                    <td className="px-4 py-2" colSpan={2} />
                    <td className="px-4 py-2">{money(calc.labourCost)}</td>
                    <td className="px-4 py-2">{money(calc.labourRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : null}

          {calc?.sprintBreakdown?.length ? (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--color-line)] font-semibold">
                Sprint / Milestone Breakdown ({calc.sprintCount} sprints × {calc.sprintWeeks} weeks)
              </div>
              <table className="w-full text-sm">
                <thead className="text-left text-[var(--color-muted)] bg-[var(--color-canvas)]">
                  <tr>
                    <th className="px-4 py-2">Milestone</th>
                    <th className="px-4 py-2">%</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Hours</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {calc.sprintBreakdown.map((s) => (
                    <Fragment key={s.order}>
                      <tr className="border-t border-[var(--color-line)]">
                        <td className="px-4 py-2">{s.name}</td>
                        <td className="px-4 py-2">{pct(s.percentage * 100)}</td>
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
                </tbody>
              </table>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <div className="card p-4 space-y-3 sticky top-4">
            <h2 className="font-semibold">Financial Results</h2>
            {!calc && (
              <p className="text-sm text-[var(--color-muted)]">
                Click Calculate to run the backend engine against current inputs.
              </p>
            )}
            {calc && (
              <>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Engagement Fee</div>
                    <div className="font-semibold text-lg">{money(calc.engagementFee)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Direct Costs</div>
                    <div className="font-semibold text-lg">{money(calc.directCosts)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Direct Margin</div>
                    <div className={`font-semibold text-lg ${healthColor}`}>
                      {money(calc.directMargin)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Margin %</div>
                    <div className={`font-semibold text-lg ${healthColor}`}>
                      {pct(calc.grossMarginPct)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Total Hours</div>
                    <div className="font-semibold">{calc.totalHours}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Departments</div>
                    <div className="font-semibold">{calc.departmentTotals?.length ?? 0}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Recommended Price</div>
                    <div className="font-semibold">{money(calc.recommendedPrice)}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-muted)] text-xs">Excess / Deficit</div>
                    <div className="font-semibold">{money(calc.excessDeficit)}</div>
                  </div>
                </div>
                <div className="text-xs text-[var(--color-muted)] space-y-1 border-t border-[var(--color-line)] pt-3">
                  <div>
                    Labour Rev {money(calc.labourRevenue)} · Cost {money(calc.labourCost)}
                  </div>
                  <div>
                    Commission {money(calc.salesCommission)} · COGS {money(calc.cogs)}
                  </div>
                  <div>
                    API Rate ${calc.apiRate.toFixed(0)}/hr · Market ${calc.marketRate.toFixed(0)}/hr
                  </div>
                  <div>Payment Terms: {calc.paymentTerms ?? '—'}</div>
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
    </form>
  );
}
