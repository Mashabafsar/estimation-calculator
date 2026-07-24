import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import type { CalcSettings, PaymentTermRule } from '../calculation/engine.js';
import { DEFAULT_CALC_SETTINGS } from '../calculation/engine.js';

export async function getSettingsMap(): Promise<Record<string, string>> {
  const rows = await prisma.globalSetting.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function listSettings() {
  return prisma.globalSetting.findMany({ orderBy: [{ category: 'asc' }, { key: 'asc' }] });
}

export async function updateSetting(key: string, value: string) {
  const existing = await prisma.globalSetting.findUnique({ where: { key } });
  if (!existing) throw new AppError('Setting not found', 404);
  return prisma.globalSetting.update({
    where: { key },
    data: { value, version: { increment: 1 } },
  });
}

export async function bulkUpdateSettings(updates: Array<{ key: string; value: string }>) {
  const results = [];
  for (const u of updates) {
    results.push(await updateSetting(u.key, u.value));
  }
  return results;
}

export async function resolveCalcSettings(overrides?: {
  commissionRate?: number;
  cogsRate?: number;
}): Promise<CalcSettings> {
  const map = await getSettingsMap();
  const num = (key: string, fallback: number) => {
    const v = map[key];
    return v != null && v !== '' ? Number(v) : fallback;
  };

  return {
    targetMarginPct: num('target_margin', DEFAULT_CALC_SETTINGS.targetMarginPct),
    commissionRate: overrides?.commissionRate ?? num('commission_pct', DEFAULT_CALC_SETTINGS.commissionRate),
    cogsRate: overrides?.cogsRate ?? num('cogs_pct', DEFAULT_CALC_SETTINGS.cogsRate),
    riskPct: num('risk_pct', DEFAULT_CALC_SETTINGS.riskPct),
    contingencyPct: num('contingency_pct', DEFAULT_CALC_SETTINGS.contingencyPct),
    infrastructurePct: num('infrastructure_pct', DEFAULT_CALC_SETTINGS.infrastructurePct),
    overheadPct: num('overhead_pct', DEFAULT_CALC_SETTINGS.overheadPct),
    supportPct: num('support_pct', DEFAULT_CALC_SETTINGS.supportPct),
    warrantyPct: num('warranty_pct', DEFAULT_CALC_SETTINGS.warrantyPct),
    maintenancePct: num('maintenance_pct', DEFAULT_CALC_SETTINGS.maintenancePct),
    taxPct: num('tax_pct', DEFAULT_CALC_SETTINGS.taxPct),
    marketOnshoreRate: num('market_onshore_rate', DEFAULT_CALC_SETTINGS.marketOnshoreRate),
    marketOffshoreRate: num('market_offshore_rate', DEFAULT_CALC_SETTINGS.marketOffshoreRate),
    workingHoursPerDay: num('working_hours_per_day', DEFAULT_CALC_SETTINGS.workingHoursPerDay),
    workingDaysPerMonth: num('working_days_per_month', DEFAULT_CALC_SETTINGS.workingDaysPerMonth),
  };
}

export async function getPaymentTermRules(): Promise<PaymentTermRule[]> {
  const rows = await prisma.paymentTerm.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map((p) => ({
    label: p.label,
    minAmount: Number(p.minAmount),
    maxAmount: p.maxAmount != null ? Number(p.maxAmount) : null,
    warrantyDays: p.warrantyDays,
    terms: p.terms,
  }));
}

export async function listPaymentTerms() {
  return prisma.paymentTerm.findMany({ orderBy: { sortOrder: 'asc' } });
}

export async function listCurrencies() {
  return prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
}

export async function listCountries() {
  return prisma.country.findMany({ where: { isActive: true }, orderBy: { name: 'asc' } });
}
