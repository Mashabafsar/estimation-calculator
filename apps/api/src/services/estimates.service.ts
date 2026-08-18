import {
  ApprovalAction,
  Complexity,
  EstimateStatus,
  ExpenseCategory,
  MarginHealth,
  Prisma,
  ResourceLocation,
} from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import { calculateEstimate } from '../calculation/engine.js';
import { getPaymentTermRules, resolveCalcSettings } from './settings.service.js';

export interface ResourceInput {
  roleId?: string;
  roleName: string;
  location: ResourceLocation;
  hours: number;
  hourlyCost: number;
  hourlyBilling: number;
}

export interface ExpenseInput {
  category: ExpenseCategory;
  name: string;
  amount: number;
  isRecurring?: boolean;
  notes?: string;
}

export interface EstimatePayload {
  projectName: string;
  description?: string;
  clientId?: string;
  templateId?: string;
  complexity?: Complexity;
  startDate?: string;
  expectedDelivery?: string;
  currencyId?: string;
  negotiatedPrice?: number | null;
  sprintCount?: number | null;
  sprintWeeks?: number | null;
  warrantyPeriodDays?: number | null;
  sprintPaymentPlan?: Array<{ name: string; percentage: number }> | null;
  resources: ResourceInput[];
  expenses: ExpenseInput[];
}

function decimal(n: number) {
  return new Prisma.Decimal(n);
}

async function nextEstimateNumber() {
  const year = new Date().getFullYear();
  const prefix = `EST-${year}-`;
  const latest = await prisma.estimate.findFirst({
    where: { estimateNumber: { startsWith: prefix } },
    orderBy: { estimateNumber: 'desc' },
  });
  const next = latest ? Number(latest.estimateNumber.split('-').pop()) + 1 : 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
}

async function runCalculation(payload: {
  resources: ResourceInput[];
  expenses: ExpenseInput[];
  negotiatedPrice?: number | null;
  templateId?: string | null;
  startDate?: Date | null;
  expectedDelivery?: Date | null;
  sprintCount?: number | null;
  sprintWeeks?: number | null;
  warrantyPeriodDays?: number | null;
  sprintPaymentPlan?: Array<{ name: string; percentage: number }> | null;
}) {
  let commissionRate: number | undefined;
  let cogsRate: number | undefined;
  // Prefer estimate-level custom plan only. Template plans are ignored so
  // advance % and warranty months always come from the calculation defaults.
  let sprintPlan = payload.sprintPaymentPlan ?? null;

  if (payload.templateId) {
    const tpl = await prisma.serviceTemplate.findUnique({ where: { id: payload.templateId } });
    if (tpl) {
      commissionRate = Number(tpl.commissionRate);
      cogsRate = Number(tpl.cogsRate);
    }
  }

  const settings = await resolveCalcSettings({ commissionRate, cogsRate });
  // Enforce company default target margin of 50% unless settings override
  if (!settings.targetMarginPct || settings.targetMarginPct <= 0) {
    settings.targetMarginPct = 0.5;
  }

  const paymentTerms = await getPaymentTermRules();

  // Dates optional — sprint count is derived from hours, not calendar
  let projectDurationDays: number | null = null;
  if (payload.startDate && payload.expectedDelivery) {
    projectDurationDays = Math.max(
      1,
      Math.ceil(
        (payload.expectedDelivery.getTime() - payload.startDate.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );
  }

  return calculateEstimate({
    resources: payload.resources.map((r) => ({
      roleName: r.roleName,
      location: r.location,
      hours: Number(r.hours),
      hourlyCost: Number(r.hourlyCost),
      hourlyBilling: Number(r.hourlyBilling),
    })),
    expenses: payload.expenses.map((e) => ({
      category: e.category,
      name: e.name,
      amount: Number(e.amount),
      isRecurring: e.isRecurring,
    })),
    negotiatedPrice: payload.negotiatedPrice,
    settings,
    paymentTerms,
    projectDurationDays,
    sprintPlan,
    warrantyPeriodDays: payload.warrantyPeriodDays,
  });
}

function calcCreateData(estimateId: string, calc: Awaited<ReturnType<typeof runCalculation>>) {
  return {
    estimateId,
    totalHours: decimal(calc.totalHours),
    labourCost: decimal(calc.labourCost),
    labourRevenue: decimal(calc.labourRevenue),
    salesCommission: decimal(calc.salesCommission),
    cogs: decimal(calc.cogs),
    expenseTotal: decimal(calc.expenseTotal),
    directCosts: decimal(calc.directCosts),
    developmentCost: decimal(calc.developmentCost),
    operatingCost: decimal(calc.operatingCost),
    engagementFee: decimal(calc.engagementFee),
    recommendedPrice: decimal(calc.recommendedPrice),
    clientPrice: decimal(calc.clientPrice),
    grossProfit: decimal(calc.grossProfit),
    netProfit: decimal(calc.netProfit),
    directMargin: decimal(calc.directMargin),
    grossMarginPct: decimal(calc.grossMarginPct),
    netMarginPct: decimal(calc.netMarginPct),
    targetMarginAmount: decimal(calc.targetMarginAmount),
    targetMarginPct: decimal(calc.targetMarginPct),
    excessDeficit: decimal(calc.excessDeficit),
    markupPct: decimal(calc.markupPct),
    discountPct: decimal(calc.discountPct),
    breakEven: decimal(calc.breakEven),
    weightedHourlyCost: decimal(calc.weightedHourlyCost),
    weightedHourlyBilling: decimal(calc.weightedHourlyBilling),
    averageTeamCost: decimal(calc.averageTeamCost),
    averageTeamBilling: decimal(calc.averageTeamBilling),
    apiRate: decimal(calc.apiRate),
    marketRate: decimal(calc.marketRate),
    riskBuffer: decimal(calc.riskBuffer),
    contingencyBuffer: decimal(calc.contingencyBuffer),
    infrastructureCost: decimal(calc.infrastructureCost),
    supportCost: decimal(calc.supportCost),
    warrantyCost: decimal(calc.warrantyCost),
    maintenanceCost: decimal(calc.maintenanceCost),
    recurringCost: decimal(calc.recurringCost),
    monthlyCost: decimal(calc.monthlyCost),
    annualCost: decimal(calc.annualCost),
    roi: decimal(calc.roi),
    marginHealth: calc.marginHealth as MarginHealth,
    paymentTermLabel: calc.paymentTermLabel,
    paymentTerms: calc.paymentTerms,
    warrantyDays: calc.warrantyDays,
    recommendations: calc.recommendations as any,
    cashFlowProjection: calc.cashFlowProjection as any,
    rawBreakdown: {
      resources: calc.resourceBreakdown,
      expenses: calc.expenseBreakdown,
    } as any,
    departmentTotals: calc.departmentTotals as any,
    sprintBreakdown: calc.sprintBreakdown as any,
  };
}

const estimateInclude = {
  client: true,
  template: true,
  currency: true,
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  resources: { orderBy: { sortOrder: 'asc' as const } },
  expenses: { orderBy: { sortOrder: 'asc' as const } },
  calculation: true,
  scenarios: { orderBy: { createdAt: 'asc' as const } },
  versions: {
    orderBy: { version: 'desc' as const },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } } },
  },
  approvals: {
    orderBy: { createdAt: 'desc' as const },
    include: { actor: { select: { id: true, firstName: true, lastName: true } } },
  },
};

export async function listEstimates(filters?: { status?: EstimateStatus; clientId?: string }) {
  return prisma.estimate.findMany({
    where: {
      status: filters?.status,
      clientId: filters?.clientId,
      archivedAt: null,
    },
    include: {
      client: true,
      template: true,
      calculation: true,
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });
}

export async function getEstimate(id: string) {
  const estimate = await prisma.estimate.findUnique({
    where: { id },
    include: estimateInclude,
  });
  if (!estimate) throw new AppError('Estimate not found', 404);
  return estimate;
}

export async function previewCalculation(payload: EstimatePayload) {
  return runCalculation({
    resources: payload.resources,
    expenses: payload.expenses,
    negotiatedPrice: payload.negotiatedPrice,
    templateId: payload.templateId,
    startDate: payload.startDate ? new Date(payload.startDate) : null,
    expectedDelivery: payload.expectedDelivery ? new Date(payload.expectedDelivery) : null,
    warrantyPeriodDays: payload.warrantyPeriodDays,
    sprintPaymentPlan: payload.sprintPaymentPlan,
  });
}

export async function createEstimate(userId: string, payload: EstimatePayload) {
  const startDate = payload.startDate ? new Date(payload.startDate) : null;
  const expectedDelivery = payload.expectedDelivery ? new Date(payload.expectedDelivery) : null;

  const calc = await runCalculation({
    resources: payload.resources,
    expenses: payload.expenses,
    negotiatedPrice: payload.negotiatedPrice,
    templateId: payload.templateId,
    startDate,
    expectedDelivery,
    warrantyPeriodDays: payload.warrantyPeriodDays,
    sprintPaymentPlan: payload.sprintPaymentPlan,
  });

  const estimateNumber = await nextEstimateNumber();

  const estimate = await prisma.estimate.create({
    data: {
      estimateNumber,
      projectName: payload.projectName,
      description: payload.description,
      clientId: payload.clientId,
      templateId: payload.templateId,
      complexity: payload.complexity ?? Complexity.MEDIUM,
      startDate,
      expectedDelivery,
      currencyId: payload.currencyId,
      negotiatedPrice: payload.negotiatedPrice != null ? decimal(payload.negotiatedPrice) : null,
      recommendedPrice: decimal(calc.recommendedPrice),
      discountPct: decimal(calc.discountPct),
      sprintCount: calc.sprintCount,
      sprintWeeks: calc.sprintWeeks,
      warrantyPeriodDays: calc.warrantyPeriodDays,
      sprintPaymentPlan: (payload.sprintPaymentPlan as any) ?? undefined,
      createdById: userId,
      resources: {
        create: payload.resources.map((r, i) => ({
          roleId: r.roleId,
          roleName: r.roleName,
          location: r.location,
          hours: decimal(r.hours),
          hourlyCost: decimal(r.hourlyCost),
          hourlyBilling: decimal(r.hourlyBilling),
          totalCost: decimal(r.hours * r.hourlyCost),
          totalRevenue: decimal(r.hours * r.hourlyBilling),
          sortOrder: i,
        })),
      },
      expenses: {
        create: payload.expenses.map((e, i) => ({
          category: e.category,
          name: e.name,
          amount: decimal(e.amount),
          isRecurring: e.isRecurring ?? false,
          notes: e.notes,
          sortOrder: i,
        })),
      },
      versions: {
        create: {
          version: 1,
          changeSummary: 'Initial version',
          createdById: userId,
          snapshot: { payload, calc } as any,
        },
      },
    },
  });

  await prisma.estimateCalculation.create({ data: calcCreateData(estimate.id, calc) });

  return getEstimate(estimate.id);
}

export async function updateEstimate(id: string, userId: string, payload: EstimatePayload) {
  const existing = await prisma.estimate.findUnique({ where: { id } });
  if (!existing) throw new AppError('Estimate not found', 404);

  const startDate = payload.startDate ? new Date(payload.startDate) : null;
  const expectedDelivery = payload.expectedDelivery ? new Date(payload.expectedDelivery) : null;

  const calc = await runCalculation({
    resources: payload.resources,
    expenses: payload.expenses,
    negotiatedPrice: payload.negotiatedPrice,
    templateId: payload.templateId,
    startDate,
    expectedDelivery,
    warrantyPeriodDays: payload.warrantyPeriodDays,
    sprintPaymentPlan: payload.sprintPaymentPlan,
  });

  const nextVersion = existing.currentVersion + 1;

  const calcData = calcCreateData(id, calc);
  const { estimateId: _omit, ...calcUpdate } = calcData;

  await prisma.$transaction(async (tx) => {
    await tx.estimateResource.deleteMany({ where: { estimateId: id } });
    await tx.estimateExpense.deleteMany({ where: { estimateId: id } });

    await tx.estimate.update({
      where: { id },
      data: {
        projectName: payload.projectName,
        description: payload.description,
        clientId: payload.clientId,
        templateId: payload.templateId,
        complexity: payload.complexity ?? existing.complexity,
        startDate,
        expectedDelivery,
        currencyId: payload.currencyId,
        negotiatedPrice: payload.negotiatedPrice != null ? decimal(payload.negotiatedPrice) : null,
        recommendedPrice: decimal(calc.recommendedPrice),
        discountPct: decimal(calc.discountPct),
        sprintCount: calc.sprintCount,
        sprintWeeks: calc.sprintWeeks,
        warrantyPeriodDays: calc.warrantyPeriodDays,
        sprintPaymentPlan: (payload.sprintPaymentPlan as any) ?? undefined,
        currentVersion: nextVersion,
        resources: {
          create: payload.resources.map((r, i) => ({
            roleId: r.roleId,
            roleName: r.roleName,
            location: r.location,
            hours: decimal(r.hours),
            hourlyCost: decimal(r.hourlyCost),
            hourlyBilling: decimal(r.hourlyBilling),
            totalCost: decimal(r.hours * r.hourlyCost),
            totalRevenue: decimal(r.hours * r.hourlyBilling),
            sortOrder: i,
          })),
        },
        expenses: {
          create: payload.expenses.map((e, i) => ({
            category: e.category,
            name: e.name,
            amount: decimal(e.amount),
            isRecurring: e.isRecurring ?? false,
            notes: e.notes,
            sortOrder: i,
          })),
        },
      },
    });

    await tx.estimateCalculation.upsert({
      where: { estimateId: id },
      create: calcData,
      update: calcUpdate,
    });

    await tx.estimateVersion.create({
      data: {
        estimateId: id,
        version: nextVersion,
        changeSummary: `Updated to version ${nextVersion}`,
        createdById: userId,
        snapshot: { payload, calc } as any,
      },
    });
  });

  return getEstimate(id);
}

export async function transitionStatus(
  id: string,
  userId: string,
  action: ApprovalAction,
  comment?: string,
) {
  const estimate = await prisma.estimate.findUnique({ where: { id } });
  if (!estimate) throw new AppError('Estimate not found', 404);

  const transitions: Partial<Record<ApprovalAction, { from: EstimateStatus[]; to: EstimateStatus }>> = {
    SUBMIT: {
      from: [EstimateStatus.DRAFT, EstimateStatus.REJECTED],
      to: EstimateStatus.PRE_SALES_REVIEW,
    },
    APPROVE: {
      from: [EstimateStatus.PRE_SALES_REVIEW, EstimateStatus.MANAGEMENT_REVIEW],
      to:
        estimate.status === EstimateStatus.PRE_SALES_REVIEW
          ? EstimateStatus.MANAGEMENT_REVIEW
          : EstimateStatus.APPROVED,
    },
    REJECT: {
      from: [EstimateStatus.PRE_SALES_REVIEW, EstimateStatus.MANAGEMENT_REVIEW],
      to: EstimateStatus.REJECTED,
    },
    REQUEST_CHANGES: {
      from: [EstimateStatus.PRE_SALES_REVIEW, EstimateStatus.MANAGEMENT_REVIEW],
      to: EstimateStatus.DRAFT,
    },
    ARCHIVE: {
      from: Object.values(EstimateStatus),
      to: EstimateStatus.ARCHIVED,
    },
  };

  const rule = transitions[action];
  if (!rule) throw new AppError('Invalid action', 400);
  if (!rule.from.includes(estimate.status)) {
    throw new AppError(`Cannot ${action} from status ${estimate.status}`, 400);
  }

  const toStatus = rule.to;
  await prisma.$transaction([
    prisma.estimate.update({
      where: { id },
      data: {
        status: toStatus,
        archivedAt: toStatus === EstimateStatus.ARCHIVED ? new Date() : estimate.archivedAt,
        wonAt: toStatus === EstimateStatus.WON ? new Date() : estimate.wonAt,
        lostAt: toStatus === EstimateStatus.LOST ? new Date() : estimate.lostAt,
      },
    }),
    prisma.approval.create({
      data: {
        estimateId: id,
        action,
        fromStatus: estimate.status,
        toStatus,
        comment,
        actorId: userId,
      },
    }),
  ]);

  return getEstimate(id);
}

export async function markDeal(id: string, userId: string, outcome: 'WON' | 'LOST') {
  const status = outcome === 'WON' ? EstimateStatus.WON : EstimateStatus.LOST;
  await prisma.estimate.update({
    where: { id },
    data: {
      status,
      wonAt: outcome === 'WON' ? new Date() : null,
      lostAt: outcome === 'LOST' ? new Date() : null,
    },
  });
  await prisma.approval.create({
    data: {
      estimateId: id,
      action: ApprovalAction.APPROVE,
      toStatus: status,
      comment: `Marked as ${outcome}`,
      actorId: userId,
    },
  });
  return getEstimate(id);
}

export async function addScenario(
  estimateId: string,
  data: { name: string; negotiatedPrice?: number; notes?: string; isWinner?: boolean },
) {
  const estimate = await getEstimate(estimateId);
  const calc = await runCalculation({
    resources: estimate.resources.map((r) => ({
      roleId: r.roleId ?? undefined,
      roleName: r.roleName,
      location: r.location,
      hours: Number(r.hours),
      hourlyCost: Number(r.hourlyCost),
      hourlyBilling: Number(r.hourlyBilling),
    })),
    expenses: estimate.expenses.map((e) => ({
      category: e.category,
      name: e.name,
      amount: Number(e.amount),
      isRecurring: e.isRecurring,
    })),
    negotiatedPrice: data.negotiatedPrice ?? Number(estimate.negotiatedPrice),
    templateId: estimate.templateId,
    startDate: estimate.startDate,
    expectedDelivery: estimate.expectedDelivery,
  });

  if (data.isWinner) {
    await prisma.estimateScenario.updateMany({
      where: { estimateId },
      data: { isWinner: false },
    });
  }

  return prisma.estimateScenario.create({
    data: {
      estimateId,
      name: data.name,
      negotiatedPrice: data.negotiatedPrice != null ? decimal(data.negotiatedPrice) : null,
      isWinner: data.isWinner ?? false,
      notes: data.notes,
      resourceSnapshot: estimate.resources as any,
      expenseSnapshot: estimate.expenses as any,
      resultSnapshot: calc as any,
    },
  });
}

export async function exportEstimate(id: string, format: 'json' | 'csv') {
  const estimate = await getEstimate(id);
  if (format === 'json') return estimate;

  const calc = estimate.calculation;
  const lines = [
    ['Field', 'Value'],
    ['Estimate Number', estimate.estimateNumber],
    ['Project', estimate.projectName],
    ['Client', estimate.client?.name ?? ''],
    ['Status', estimate.status],
    ['Engagement Fee', calc?.engagementFee?.toString() ?? ''],
    ['Direct Costs', calc?.directCosts?.toString() ?? ''],
    ['Direct Margin', calc?.directMargin?.toString() ?? ''],
    ['Gross Margin %', calc?.grossMarginPct?.toString() ?? ''],
    ['Recommended Price', calc?.recommendedPrice?.toString() ?? ''],
    ['Negotiated Price', estimate.negotiatedPrice?.toString() ?? ''],
  ];
  return lines.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}
