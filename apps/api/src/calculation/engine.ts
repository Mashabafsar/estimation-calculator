/**
 * Financial Calculation Engine
 * Source of truth: API Cost Calculator Excel + api_cost_calculator.html
 * All formulas preserved; additional metrics layered on top.
 */

export type ResourceLocation = 'ONSHORE' | 'OFFSHORE';

export interface CalcResourceInput {
  roleName: string;
  location: ResourceLocation;
  hours: number;
  hourlyCost: number;
  hourlyBilling: number;
}

export interface CalcExpenseInput {
  category: string;
  name: string;
  amount: number;
  isRecurring?: boolean;
}

export interface CalcSettings {
  targetMarginPct: number;
  commissionRate: number;
  cogsRate: number;
  riskPct: number;
  contingencyPct: number;
  infrastructurePct: number;
  overheadPct: number;
  supportPct: number;
  warrantyPct: number;
  maintenancePct: number;
  taxPct: number;
  marketOnshoreRate: number;
  marketOffshoreRate: number;
  workingHoursPerDay: number;
  workingDaysPerMonth: number;
}

export interface PaymentTermRule {
  label: string;
  minAmount: number;
  maxAmount: number | null;
  warrantyDays: number;
  terms: string;
}

export interface SprintMilestoneInput {
  name: string;
  percentage: number; // 0–1 share of fee / hours
}

export interface CalculateInput {
  resources: CalcResourceInput[];
  expenses: CalcExpenseInput[];
  negotiatedPrice?: number | null;
  settings: CalcSettings;
  paymentTerms: PaymentTermRule[];
  projectDurationDays?: number | null;
  /** @deprecated Auto-calculated from hours; ignored when provided unless force */
  sprintCount?: number | null;
  /** Always fixed at 2 weeks */
  sprintWeeks?: number | null;
  /** Custom milestone plan (from template or estimate). Percentages 0–1. */
  sprintPlan?: SprintMilestoneInput[] | null;
  /** Warranty period length in months (1% of fee retained per month). Default 3. */
  warrantyMonths?: number | null;
}

export interface DepartmentTotal {
  department: string;
  hours: number;
  hourlyCost: number;
  hourlyBilling: number;
  totalCost: number;
  totalRevenue: number;
  pctOfHours: number;
}

export interface SprintBreakdownItem {
  name: string;
  order: number;
  percentage: number;
  amount: number;
  hours: number;
  weeks?: number;
  departmentHours: Array<{ department: string; hours: number; cost: number; revenue: number }>;
}

export type MarginHealth = 'GREEN' | 'YELLOW' | 'RED';

export interface Recommendation {
  type: string;
  message: string;
  amount?: number;
}

export interface CalculateResult {
  totalHours: number;
  labourCost: number;
  labourRevenue: number;
  salesCommission: number;
  cogs: number;
  expenseTotal: number;
  subcontractorTotal: number;
  directCosts: number;
  developmentCost: number;
  operatingCost: number;
  engagementFee: number;
  recommendedPrice: number;
  clientPrice: number;
  grossProfit: number;
  netProfit: number;
  directMargin: number;
  grossMarginPct: number;
  netMarginPct: number;
  targetMarginAmount: number;
  targetMarginPct: number;
  excessDeficit: number;
  markupPct: number;
  discountPct: number;
  breakEven: number;
  weightedHourlyCost: number;
  weightedHourlyBilling: number;
  averageTeamCost: number;
  averageTeamBilling: number;
  apiRate: number;
  marketRate: number;
  riskBuffer: number;
  contingencyBuffer: number;
  infrastructureCost: number;
  supportCost: number;
  warrantyCost: number;
  maintenanceCost: number;
  recurringCost: number;
  monthlyCost: number;
  annualCost: number;
  roi: number;
  marginHealth: MarginHealth;
  paymentTermLabel: string | null;
  paymentTerms: string | null;
  warrantyDays: number | null;
  recommendations: Recommendation[];
  cashFlowProjection: Array<{ month: number; inflow: number; outflow: number; net: number }>;
  resourceBreakdown: Array<{
    roleName: string;
    location: ResourceLocation;
    hours: number;
    hourlyCost: number;
    hourlyBilling: number;
    totalCost: number;
    totalRevenue: number;
  }>;
  expenseBreakdown: Array<{
    category: string;
    name: string;
    amount: number;
    isRecurring: boolean;
  }>;
  /** Aggregated hours/cost/revenue per selected department (role) — Hours Breakdown sheet */
  departmentTotals: DepartmentTotal[];
  /** Milestone / sprint payment + effort allocation — Payment Breakdown sheet */
  sprintBreakdown: SprintBreakdownItem[];
  sprintCount: number;
  sprintWeeks: number;
  /** Human-readable sprint formula used */
  sprintFormula: string;
  /** Warranty period months used in payment plan (1% per month) */
  warrantyMonths: number;
  /**
   * Engagement fee rule (Excel/HTML):
   * negotiatedPrice > 0  → engagementFee = negotiatedPrice
   * otherwise            → engagementFee = labourRevenue
   */
  engagementFeeSource: 'negotiated_price' | 'labour_revenue';
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;
const safeDiv = (a: number, b: number) => (b === 0 ? 0 : a / b);

function resolvePaymentTerm(fee: number, terms: PaymentTermRule[]): PaymentTermRule | null {
  const sorted = [...terms].sort((a, b) => a.minAmount - b.minAmount);
  for (let i = sorted.length - 1; i >= 0; i--) {
    const t = sorted[i];
    const underMax = t.maxAmount == null || fee <= t.maxAmount;
    if (fee >= t.minAmount && underMax) return t;
  }
  return sorted[0] ?? null;
}

function marginHealth(pct: number): MarginHealth {
  // Spec: Green >50%, Yellow 40–50%, Red <40%
  if (pct >= 50) return 'GREEN';
  if (pct >= 40) return 'YELLOW';
  return 'RED';
}

/** Aggregate selected resources by department/role (Excel Hours Breakdown totals). */
export function buildDepartmentTotals(
  resources: Array<{
    roleName: string;
    hours: number;
    hourlyCost: number;
    hourlyBilling: number;
    totalCost: number;
    totalRevenue: number;
  }>,
): DepartmentTotal[] {
  const map = new Map<
    string,
    { hours: number; costWeighted: number; billWeighted: number; totalCost: number; totalRevenue: number }
  >();

  for (const r of resources) {
    if (!r.hours && !r.totalCost && !r.totalRevenue) continue;
    const key = r.roleName || 'Unassigned';
    const row = map.get(key) ?? {
      hours: 0,
      costWeighted: 0,
      billWeighted: 0,
      totalCost: 0,
      totalRevenue: 0,
    };
    row.hours += r.hours;
    row.costWeighted += r.hourlyCost * r.hours;
    row.billWeighted += r.hourlyBilling * r.hours;
    row.totalCost += r.totalCost;
    row.totalRevenue += r.totalRevenue;
    map.set(key, row);
  }

  const totalHours = [...map.values()].reduce((s, r) => s + r.hours, 0);
  return [...map.entries()]
    .map(([department, r]) => ({
      department,
      hours: round2(r.hours),
      hourlyCost: round4(safeDiv(r.costWeighted, r.hours)),
      hourlyBilling: round4(safeDiv(r.billWeighted, r.hours)),
      totalCost: round2(r.totalCost),
      totalRevenue: round2(r.totalRevenue),
      pctOfHours: round4(safeDiv(r.hours, totalHours) * 100),
    }))
    .sort((a, b) => b.hours - a.hours);
}

/**
 * Sprint count formula (fixed 2-week sprints):
 * personHoursPerSprint = workingHoursPerDay × 5 days × 2 weeks
 * sprintCount = ceil( max(departmentHours) / personHoursPerSprint )
 *
 * Uses the heaviest department as critical path (teams work in parallel).
 * Minimum 1 sprint.
 */
export const FIXED_SPRINT_WEEKS = 2;

export function calculateSprintCount(
  departmentTotals: DepartmentTotal[],
  totalHours: number,
  workingHoursPerDay = 8,
): { sprintCount: number; sprintWeeks: number; formula: string; personHoursPerSprint: number } {
  const sprintWeeks = FIXED_SPRINT_WEEKS;
  const personHoursPerSprint = workingHoursPerDay * 5 * sprintWeeks; // e.g. 8×5×2 = 80
  const maxDeptHours = departmentTotals.reduce((m, d) => Math.max(m, d.hours), 0);
  const basisHours = maxDeptHours > 0 ? maxDeptHours : totalHours;
  const sprintCount = Math.max(1, Math.ceil(basisHours / personHoursPerSprint));
  const formula =
    maxDeptHours > 0
      ? `ceil(maxDeptHours ${maxDeptHours} ÷ (${workingHoursPerDay}h × 5d × ${sprintWeeks}w = ${personHoursPerSprint}h)) = ${sprintCount}`
      : `ceil(totalHours ${totalHours} ÷ ${personHoursPerSprint}h/sprint) = ${sprintCount}`;
  return { sprintCount, sprintWeeks, formula, personHoursPerSprint };
}
/** Share of engagement fee held per warranty month (Excel: 1% × N months). */
export const WARRANTY_PCT_PER_MONTH = 0.01;
/** Advance payment due upon acceptance. */
export const ADVANCE_PAYMENT_PCT = 0.3;
export const DEFAULT_WARRANTY_MONTHS = 3;

export function normalizeWarrantyMonths(value?: number | null): number {
  if (value == null || Number.isNaN(Number(value))) return DEFAULT_WARRANTY_MONTHS;
  return Math.max(0, Math.min(24, Math.round(Number(value))));
}

export function defaultSprintPlan(
  sprintCount = 10,
  warrantyMonths: number = DEFAULT_WARRANTY_MONTHS,
): SprintMilestoneInput[] {
  const n = Math.max(1, Math.min(sprintCount, 20));
  const months = normalizeWarrantyMonths(warrantyMonths);
  const advance = ADVANCE_PAYMENT_PCT;
  const design = 0.12;
  const warranty = WARRANTY_PCT_PER_MONTH * months;
  const sit = 0.1;
  const uat = 0.07;
  const deliveryPool = Math.max(0, 1 - advance - design - sit - uat - warranty);
  const perSprint = deliveryPool / n;

  const plan: SprintMilestoneInput[] = [
    { name: 'Advance Payment – Due upon acceptance', percentage: advance },
    { name: 'Payment – Upon Completion of Design Phase', percentage: design },
  ];
  for (let i = 1; i <= n; i++) {
    plan.push({ name: `Payment – Upon Completion of Sprint ${i}`, percentage: round4(perSprint) });
  }
  plan.push({ name: 'Payment – Upon Completion of SIT', percentage: sit });
  plan.push({ name: 'Payment – Upon Completion of UAT', percentage: uat });
  for (let m = 1; m <= months; m++) {
    plan.push({
      name: `Payment – Warranty Period – Month ${m}`,
      percentage: WARRANTY_PCT_PER_MONTH,
    });
  }

  // Fix rounding drift on last delivery sprint
  const sum = plan.reduce((s, p) => s + p.percentage, 0);
  if (Math.abs(sum - 1) > 0.0001 && plan.length > 2) {
    const drift = round4(1 - sum);
    const idx = 2 + n - 1; // last delivery sprint
    if (plan[idx]) plan[idx].percentage = round4(plan[idx].percentage + drift);
  }
  return plan;
}

export function buildSprintBreakdown(opts: {
  fee: number;
  totalHours: number;
  departmentTotals: DepartmentTotal[];
  sprintPlan?: SprintMilestoneInput[] | null;
  sprintCount?: number | null;
  sprintWeeks?: number | null;
  warrantyMonths?: number | null;
}): SprintBreakdownItem[] {
  const weeks = opts.sprintWeeks && opts.sprintWeeks > 0 ? opts.sprintWeeks : 2;
  const warrantyMonths = normalizeWarrantyMonths(opts.warrantyMonths);
  const plan =
    opts.sprintPlan && opts.sprintPlan.length
      ? opts.sprintPlan
      : defaultSprintPlan(opts.sprintCount ?? 10, warrantyMonths);

  const rawSum = plan.reduce((s, p) => s + Number(p.percentage || 0), 0);
  const norm = rawSum > 0 ? rawSum : 1;

  return plan.map((m, order) => {
    const percentage = round4(Number(m.percentage || 0) / norm);
    const amount = round2(opts.fee * percentage);
    const hours = round2(opts.totalHours * percentage);
    return {
      name: m.name,
      order,
      percentage,
      amount,
      hours,
      weeks: m.name.toLowerCase().includes('sprint') ? weeks : undefined,
      departmentHours: opts.departmentTotals.map((d) => ({
        department: d.department,
        hours: round2(d.hours * percentage),
        cost: round2(d.totalCost * percentage),
        revenue: round2(d.totalRevenue * percentage),
      })),
    };
  });
}

/**
 * Core engine — mirrors Excel/HTML logic:
 * labourRev = Σ(hours × billRate)
 * labourCost = Σ(hours × costRate)
 * base for commission/cogs = negotiatedFee || labourRev
 * salesCommission = base × commissionRate
 * cogs = base × cogsRate
 * engagementFee = negotiatedFee || labourRev
 * directCosts = labourCost + commission + cogs + expenses
 * directMargin = engagementFee − directCosts
 * targetMargin = engagementFee × targetMarginPct
 * excessDeficit = directMargin − targetMargin
 * marketRate = 150×onshoreWeight + 35×offshoreWeight
 */
export function calculateEstimate(input: CalculateInput): CalculateResult {
  const { resources, expenses, settings, paymentTerms } = input;
  const negotiated = input.negotiatedPrice != null ? Number(input.negotiatedPrice) : null;

  const resourceBreakdown = resources.map((r) => {
    const hours = Number(r.hours) || 0;
    const hourlyCost = Number(r.hourlyCost) || 0;
    const hourlyBilling = Number(r.hourlyBilling) || 0;
    return {
      roleName: r.roleName,
      location: r.location,
      hours,
      hourlyCost,
      hourlyBilling,
      totalCost: round2(hours * hourlyCost),
      totalRevenue: round2(hours * hourlyBilling),
    };
  });

  const expenseBreakdown = expenses.map((e) => ({
    category: e.category,
    name: e.name,
    amount: round2(Number(e.amount) || 0),
    isRecurring: Boolean(e.isRecurring),
  }));

  const totalHours = round2(resourceBreakdown.reduce((s, r) => s + r.hours, 0));
  const labourCost = round2(resourceBreakdown.reduce((s, r) => s + r.totalCost, 0));
  const labourRevenue = round2(resourceBreakdown.reduce((s, r) => s + r.totalRevenue, 0));

  const feeBase = negotiated != null && negotiated > 0 ? negotiated : labourRevenue;

  // Excel/HTML: commission & COGS applied to negotiated fee when present, else labour revenue
  const salesCommission = round2(feeBase * settings.commissionRate);
  const cogs = round2(feeBase * settings.cogsRate);

  const expenseTotal = round2(expenseBreakdown.reduce((s, e) => s + e.amount, 0));
  const subcontractorTotal = round2(
    expenseBreakdown
      .filter((e) => e.category === 'SUBCONTRACTOR')
      .reduce((s, e) => s + e.amount, 0),
  );

  const directCosts = round2(labourCost + salesCommission + cogs + expenseTotal);
  const developmentCost = round2(labourCost + subcontractorTotal);

  const riskBuffer = round2(developmentCost * settings.riskPct);
  const contingencyBuffer = round2(developmentCost * settings.contingencyPct);
  const infrastructureCost = round2(feeBase * settings.infrastructurePct);
  const supportCost = round2(feeBase * settings.supportPct);
  const warrantyCost = round2(feeBase * settings.warrantyPct);
  const maintenanceCost = round2(feeBase * settings.maintenancePct);
  const operatingCost = round2(
    salesCommission +
      cogs +
      expenseTotal -
      subcontractorTotal +
      riskBuffer +
      contingencyBuffer +
      infrastructureCost +
      supportCost +
      warrantyCost +
      maintenanceCost +
      feeBase * settings.overheadPct,
  );

  const engagementFee = round2(feeBase);
  // Recommended price to hit target margin on current direct costs
  // price − directCosts = price × targetMargin  =>  price = directCosts / (1 − targetMargin)
  const recommendedPrice =
    settings.targetMarginPct < 1
      ? round2(directCosts / (1 - settings.targetMarginPct))
      : round2(directCosts * 2);

  const clientPrice = engagementFee;
  const discountPct =
    recommendedPrice > 0 && negotiated != null && negotiated > 0
      ? round4((recommendedPrice - negotiated) / recommendedPrice)
      : 0;

  const directMargin = round2(engagementFee - directCosts);
  const grossProfit = directMargin;
  const taxAmount = round2(Math.max(grossProfit, 0) * settings.taxPct);
  const netProfit = round2(grossProfit - taxAmount);

  const grossMarginPct = round4(safeDiv(grossProfit, engagementFee) * 100);
  const netMarginPct = round4(safeDiv(netProfit, engagementFee) * 100);
  const targetMarginPct = round4(settings.targetMarginPct * 100);
  const targetMarginAmount = round2(engagementFee * settings.targetMarginPct);
  const excessDeficit = round2(directMargin - targetMarginAmount);

  const markupPct = round4(safeDiv(engagementFee - labourCost, labourCost) * 100);
  const breakEven = round2(directCosts);
  const weightedHourlyCost = round4(safeDiv(labourCost, totalHours));
  const weightedHourlyBilling = round4(safeDiv(labourRevenue, totalHours));

  const activeResources = resourceBreakdown.filter((r) => r.hours > 0);
  const averageTeamCost = round4(
    activeResources.length
      ? activeResources.reduce((s, r) => s + r.hourlyCost, 0) / activeResources.length
      : 0,
  );
  const averageTeamBilling = round4(
    activeResources.length
      ? activeResources.reduce((s, r) => s + r.hourlyBilling, 0) / activeResources.length
      : 0,
  );

  const apiRate = round4(safeDiv(labourRevenue, totalHours));
  const onshoreHours = resourceBreakdown
    .filter((r) => r.location === 'ONSHORE')
    .reduce((s, r) => s + r.hours, 0);
  const offshoreHours = resourceBreakdown
    .filter((r) => r.location === 'OFFSHORE')
    .reduce((s, r) => s + r.hours, 0);
  const onshoreWeight = safeDiv(onshoreHours, totalHours);
  const offshoreWeight = totalHours > 0 ? safeDiv(offshoreHours, totalHours) : 1;
  const marketRate = round4(
    settings.marketOnshoreRate * onshoreWeight + settings.marketOffshoreRate * offshoreWeight,
  );

  const recurringCost = round2(
    expenseBreakdown.filter((e) => e.isRecurring).reduce((s, e) => s + e.amount, 0),
  );
  const months =
    input.projectDurationDays && input.projectDurationDays > 0
      ? Math.max(1, Math.ceil(input.projectDurationDays / 30))
      : Math.max(1, Math.ceil(totalHours / (settings.workingHoursPerDay * settings.workingDaysPerMonth)));
  const monthlyCost = round2(safeDiv(directCosts, months));
  const annualCost = round2(monthlyCost * 12);
  const roi = round4(safeDiv(netProfit, directCosts) * 100);

  const payment = resolvePaymentTerm(engagementFee, paymentTerms);
  const health = marginHealth(grossMarginPct);

  const recommendations: Recommendation[] = [];
  if (excessDeficit < 0) {
    const needed = round2(Math.abs(excessDeficit) / (1 - settings.targetMarginPct));
    recommendations.push({
      type: 'INCREASE_PRICE',
      message: `Increase selling price by $${needed.toLocaleString()} to reach ${targetMarginPct}% target margin`,
      amount: needed,
    });
    if (subcontractorTotal > 0) {
      recommendations.push({
        type: 'REDUCE_SUBCONTRACTOR',
        message: 'Lower subcontractor cost to improve direct margin',
        amount: subcontractorTotal,
      });
    }
    if (totalHours > 0) {
      recommendations.push({
        type: 'REDUCE_HOURS',
        message: 'Reduce development hours or shift work to lower-cost roles',
      });
    }
    recommendations.push({
      type: 'INCREASE_MARGIN',
      message: `Increase margin to target (${targetMarginPct}%)`,
      amount: Math.abs(excessDeficit),
    });
  } else {
    recommendations.push({
      type: 'HEALTHY',
      message: `Margin is $${excessDeficit.toLocaleString()} above the ${targetMarginPct}% target`,
      amount: excessDeficit,
    });
  }

  const cashFlowProjection = Array.from({ length: months }, (_, i) => {
    const inflow = round2(engagementFee / months);
    const outflow = monthlyCost;
    return { month: i + 1, inflow, outflow, net: round2(inflow - outflow) };
  });

  // Hours Breakdown — total hours per selected department/role
  const departmentTotals = buildDepartmentTotals(resourceBreakdown);

  // Auto sprint count (2-week sprints); ignore manual sprint inputs
  const sprintMeta = calculateSprintCount(
    departmentTotals,
    totalHours,
    settings.workingHoursPerDay,
  );
  const sprintCount = sprintMeta.sprintCount;
  const sprintWeeks = sprintMeta.sprintWeeks;
  const warrantyMonths = normalizeWarrantyMonths(input.warrantyMonths);
  const sprintBreakdown = buildSprintBreakdown({
    fee: engagementFee,
    totalHours,
    departmentTotals,
    sprintPlan: input.sprintPlan,
    sprintCount,
    sprintWeeks,
    warrantyMonths,
  });

  const engagementFeeSource =
    negotiated != null && negotiated > 0 ? 'negotiated_price' : 'labour_revenue';

  return {
    totalHours,
    labourCost,
    labourRevenue,
    salesCommission,
    cogs,
    expenseTotal,
    subcontractorTotal,
    directCosts,
    developmentCost,
    operatingCost,
    engagementFee,
    recommendedPrice,
    clientPrice,
    grossProfit,
    netProfit,
    directMargin,
    grossMarginPct,
    netMarginPct,
    targetMarginAmount,
    targetMarginPct,
    excessDeficit,
    markupPct,
    discountPct,
    breakEven,
    weightedHourlyCost,
    weightedHourlyBilling,
    averageTeamCost,
    averageTeamBilling,
    apiRate,
    marketRate,
    riskBuffer,
    contingencyBuffer,
    infrastructureCost,
    supportCost,
    warrantyCost,
    maintenanceCost,
    recurringCost,
    monthlyCost,
    annualCost,
    roi,
    marginHealth: health,
    paymentTermLabel: payment?.label ?? null,
    paymentTerms: payment?.terms ?? null,
    warrantyDays: payment?.warrantyDays ?? null,
    recommendations,
    cashFlowProjection,
    resourceBreakdown,
    expenseBreakdown,
    departmentTotals,
    sprintBreakdown,
    sprintCount,
    sprintWeeks,
    sprintFormula: sprintMeta.formula,
    warrantyMonths,
    engagementFeeSource,
  };
}

export const DEFAULT_CALC_SETTINGS: CalcSettings = {
  targetMarginPct: 0.5,
  commissionRate: 0.04,
  cogsRate: 0.036,
  riskPct: 0.05,
  contingencyPct: 0.05,
  infrastructurePct: 0.02,
  overheadPct: 0.03,
  supportPct: 0.01,
  warrantyPct: 0.01,
  maintenancePct: 0.02,
  taxPct: 0,
  marketOnshoreRate: 150,
  marketOffshoreRate: 35,
  workingHoursPerDay: 8,
  workingDaysPerMonth: 22,
};
