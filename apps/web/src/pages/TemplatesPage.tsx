import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { api, money, pct } from '../lib/api';
import { useAuth } from '../context/AuthContext';

interface Role {
  id: string;
  name: string;
  hourlyCostRate: string;
  hourlyBillingRate: string;
  defaultLocation: 'ONSHORE' | 'OFFSHORE';
}

type TemplateForm = {
  name: string;
  slug: string;
  description: string;
  commissionRate: number;
  cogsRate: number;
  defaultSubcontractor: number;
  defaultDevServerCost: number;
  defaultMargin: number;
  defaultSprintCount: number;
  defaultSprintWeeks: number;
  isActive: boolean;
  roles: Array<{
    roleId: string;
    location: 'ONSHORE' | 'OFFSHORE';
    defaultHours: number;
    billRateOverride: number | '';
    costRateOverride: number | '';
  }>;
};

const emptyForm = (): TemplateForm => ({
  name: '',
  slug: '',
  description: '',
  commissionRate: 0.04,
  cogsRate: 0.036,
  defaultSubcontractor: 0,
  defaultDevServerCost: 0,
  defaultMargin: 0.5,
  defaultSprintCount: 10,
  defaultSprintWeeks: 2,
  isActive: true,
  roles: [],
});

export function TemplatesPage() {
  const { token, user } = useAuth();
  const canEdit = user?.role === 'ADMIN' || user?.role === 'SOLUTION_ARCHITECT';
  const [templates, setTemplates] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const { register, control, handleSubmit, reset, setValue, watch } = useForm<TemplateForm>({
    defaultValues: emptyForm(),
  });
  const roleFields = useFieldArray({ control, name: 'roles' });

  async function load() {
    const [t, r] = await Promise.all([
      api<any[]>('/templates?all=true', { token }),
      api<Role[]>('/roles', { token }),
    ]);
    setTemplates(t);
    setRoles(r);
  }

  useEffect(() => {
    load().catch(console.error);
  }, [token]);

  function selectTemplate(t: any) {
    setSelectedId(t.id);
    reset({
      name: t.name,
      slug: t.slug,
      description: t.description ?? '',
      commissionRate: Number(t.commissionRate),
      cogsRate: Number(t.cogsRate),
      defaultSubcontractor: Number(t.defaultSubcontractor),
      defaultDevServerCost: Number(t.defaultDevServerCost),
      defaultMargin: t.defaultMargin != null ? Number(t.defaultMargin) : 0.5,
      defaultSprintCount: t.defaultSprintCount ?? 10,
      defaultSprintWeeks: t.defaultSprintWeeks ?? 2,
      isActive: t.isActive,
      roles: (t.roles || []).map((tr: any) => ({
        roleId: tr.roleId,
        location: tr.location,
        defaultHours: Number(tr.defaultHours),
        billRateOverride: tr.billRateOverride != null ? Number(tr.billRateOverride) : '',
        costRateOverride: tr.costRateOverride != null ? Number(tr.costRateOverride) : '',
      })),
    });
  }

  function startCreate() {
    setSelectedId(null);
    reset(emptyForm());
  }

  async function onSave(values: TemplateForm) {
    if (!canEdit) return;
    setSaving(true);
    setMessage('');
    try {
      const payload = {
        ...values,
        slug: values.slug || undefined,
        roles: values.roles.map((r) => ({
          roleId: r.roleId,
          location: r.location,
          defaultHours: Number(r.defaultHours) || 0,
          billRateOverride: r.billRateOverride === '' ? null : Number(r.billRateOverride),
          costRateOverride: r.costRateOverride === '' ? null : Number(r.costRateOverride),
        })),
      };
      if (selectedId) {
        await api(`/templates/${selectedId}`, {
          method: 'PUT',
          token,
          body: JSON.stringify(payload),
        });
        setMessage('Template updated');
      } else {
        const created = await api<any>('/templates', {
          method: 'POST',
          token,
          body: JSON.stringify(payload),
        });
        setSelectedId(created.id);
        setMessage('Template created');
      }
      await load();
    } catch (e: any) {
      setMessage(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!selectedId || !canEdit) return;
    if (!confirm('Deactivate / delete this template?')) return;
    await api(`/templates/${selectedId}`, { method: 'DELETE', token });
    startCreate();
    await load();
    setMessage('Template removed');
  }

  const watchedName = watch('name');

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Service Templates</h1>
          <p className="page-subtitle">
            Configure default departments/resources, rates, sprints, and financial defaults.
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" type="button" onClick={startCreate}>
            New Template
          </button>
        )}
      </div>

      {message && <div className="text-sm text-emerald-600">{message}</div>}

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="card overflow-hidden h-fit">
          <div className="px-4 py-3 border-b border-[var(--color-line)] font-semibold text-sm">
            Templates
          </div>
          <div className="max-h-[70vh] overflow-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTemplate(t)}
                className={`w-full text-left px-4 py-3 border-b border-[var(--color-line)] hover:bg-[var(--color-canvas)] ${
                  selectedId === t.id ? 'bg-[var(--color-accent-soft)]' : ''
                }`}
              >
                <div className="font-medium text-sm">{t.name}</div>
                <div className="text-xs text-[var(--color-muted)] mt-0.5">
                  {t.roles?.length ?? 0} resources · {t.defaultSprintCount ?? 10} sprints
                  {!t.isActive ? ' · inactive' : ''}
                </div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit(onSave)} className="lg:col-span-2 card p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{selectedId ? 'Edit Template' : 'Create Template'}</h2>
            {canEdit && (
              <div className="flex gap-2">
                {selectedId && (
                  <button type="button" className="btn btn-ghost" onClick={onDelete}>
                    Delete
                  </button>
                )}
                <button className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
              </div>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm space-y-1">
              <span className="font-medium">Name</span>
              <input
                className="input"
                disabled={!canEdit}
                {...register('name', { required: true })}
                onBlur={() => {
                  if (!selectedId && watchedName && !watch('slug')) {
                    setValue(
                      'slug',
                      watchedName
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, ''),
                    );
                  }
                }}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Slug</span>
              <input className="input" disabled={!canEdit} {...register('slug')} />
            </label>
            <label className="text-sm space-y-1 sm:col-span-2">
              <span className="font-medium">Description</span>
              <textarea className="input min-h-16" disabled={!canEdit} {...register('description')} />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Commission Rate (0–1)</span>
              <input
                className="input"
                type="number"
                step="0.001"
                disabled={!canEdit}
                {...register('commissionRate', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">COGS Rate (0–1)</span>
              <input
                className="input"
                type="number"
                step="0.001"
                disabled={!canEdit}
                {...register('cogsRate', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Default Subcontractor $</span>
              <input
                className="input"
                type="number"
                disabled={!canEdit}
                {...register('defaultSubcontractor', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Default Dev Server $</span>
              <input
                className="input"
                type="number"
                disabled={!canEdit}
                {...register('defaultDevServerCost', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Default Margin (0–1)</span>
              <input
                className="input"
                type="number"
                step="0.01"
                disabled={!canEdit}
                {...register('defaultMargin', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Active</span>
              <select
                className="input"
                disabled={!canEdit}
                {...register('isActive', {
                  setValueAs: (v) => v === 'true' || v === true,
                })}
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Default Sprint Count</span>
              <input
                className="input"
                type="number"
                min={1}
                disabled={!canEdit}
                {...register('defaultSprintCount', { valueAsNumber: true })}
              />
            </label>
            <label className="text-sm space-y-1">
              <span className="font-medium">Default Sprint Weeks</span>
              <input
                className="input"
                type="number"
                min={1}
                disabled={!canEdit}
                {...register('defaultSprintWeeks', { valueAsNumber: true })}
              />
            </label>
          </div>

          <div className="space-y-3 border-t border-[var(--color-line)] pt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Default Resources / Departments</h3>
              {canEdit && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    const role = roles[0];
                    if (!role) return;
                    roleFields.append({
                      roleId: role.id,
                      location: role.defaultLocation,
                      defaultHours: 0,
                      billRateOverride: '',
                      costRateOverride: '',
                    });
                  }}
                >
                  Add Resource
                </button>
              )}
            </div>
            {roleFields.fields.map((field, index) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-end">
                <label className="col-span-4 text-xs space-y-1">
                  <span>Role</span>
                  <select className="input" disabled={!canEdit} {...register(`roles.${index}.roleId`)}>
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="col-span-2 text-xs space-y-1">
                  <span>Location</span>
                  <select className="input" disabled={!canEdit} {...register(`roles.${index}.location`)}>
                    <option value="ONSHORE">Onshore</option>
                    <option value="OFFSHORE">Offshore</option>
                  </select>
                </label>
                <label className="col-span-2 text-xs space-y-1">
                  <span>Hours</span>
                  <input
                    className="input"
                    type="number"
                    disabled={!canEdit}
                    {...register(`roles.${index}.defaultHours`, { valueAsNumber: true })}
                  />
                </label>
                <label className="col-span-1 text-xs space-y-1">
                  <span>Cost</span>
                  <input
                    className="input"
                    type="number"
                    placeholder="def"
                    disabled={!canEdit}
                    {...register(`roles.${index}.costRateOverride`, { valueAsNumber: true })}
                  />
                </label>
                <label className="col-span-2 text-xs space-y-1">
                  <span>Bill</span>
                  <input
                    className="input"
                    type="number"
                    placeholder="def"
                    disabled={!canEdit}
                    {...register(`roles.${index}.billRateOverride`, { valueAsNumber: true })}
                  />
                </label>
                {canEdit && (
                  <button
                    type="button"
                    className="btn btn-ghost col-span-1"
                    onClick={() => roleFields.remove(index)}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
            {!roleFields.fields.length && (
              <p className="text-sm text-[var(--color-muted)]">No default resources yet.</p>
            )}
          </div>

          {selectedId && (
            <div className="text-xs text-[var(--color-muted)] border-t border-[var(--color-line)] pt-3">
              Commission {pct(Number(watch('commissionRate')) * 100)} · COGS{' '}
              {pct(Number(watch('cogsRate')) * 100)} · Sub{' '}
              {money(watch('defaultSubcontractor'))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
