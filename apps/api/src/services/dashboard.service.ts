import { EstimateStatus, MarginHealth } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export async function getDashboard() {
  const estimates = await prisma.estimate.findMany({
    include: {
      calculation: true,
      resources: true,
      client: true,
      template: true,
    },
  });

  const active = estimates.filter((e) => e.status !== EstimateStatus.ARCHIVED);
  const won = active.filter((e) => e.status === EstimateStatus.WON);
  const lost = active.filter((e) => e.status === EstimateStatus.LOST);
  const pipelineStatuses = new Set<EstimateStatus>([
    EstimateStatus.DRAFT,
    EstimateStatus.PRE_SALES_REVIEW,
    EstimateStatus.MANAGEMENT_REVIEW,
    EstimateStatus.APPROVED,
  ]);
  const pipeline = active.filter((e) => pipelineStatuses.has(e.status));

  const withCalc = active.filter((e) => e.calculation);
  const margins = withCalc.map((e) => Number(e.calculation!.grossMarginPct));
  const prices = withCalc.map((e) => Number(e.calculation!.engagementFee));
  const costs = withCalc.map((e) => Number(e.calculation!.developmentCost));
  const durations = active
    .filter((e) => e.startDate && e.expectedDelivery)
    .map((e) =>
      Math.ceil(
        (e.expectedDelivery!.getTime() - e.startDate!.getTime()) / (1000 * 60 * 60 * 24),
      ),
    );

  const totalHours = active.reduce(
    (s, e) => s + e.resources.reduce((h, r) => h + Number(r.hours), 0),
    0,
  );
  const capacityHours = 22 * 8 * 20; // rough monthly capacity placeholder
  const resourceUtilization = Math.min(100, (totalHours / capacityHours) * 100);

  const revenuePipeline = pipeline.reduce(
    (s, e) => s + Number(e.calculation?.engagementFee ?? e.negotiatedPrice ?? 0),
    0,
  );

  // Monthly estimated revenue (by expected delivery month)
  const monthlyMap = new Map<string, number>();
  for (const e of withCalc) {
    const d = e.expectedDelivery ?? e.createdAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + Number(e.calculation!.engagementFee));
  }
  const monthlyRevenue = [...monthlyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }));

  const marginDistribution = {
    green: withCalc.filter((e) => e.calculation!.marginHealth === MarginHealth.GREEN).length,
    yellow: withCalc.filter((e) => e.calculation!.marginHealth === MarginHealth.YELLOW).length,
    red: withCalc.filter((e) => e.calculation!.marginHealth === MarginHealth.RED).length,
  };

  const dealStatus = Object.values(EstimateStatus).map((status) => ({
    status,
    count: estimates.filter((e) => e.status === status).length,
  }));

  const costBreakdown = {
    labour: withCalc.reduce((s, e) => s + Number(e.calculation!.labourCost), 0),
    commission: withCalc.reduce((s, e) => s + Number(e.calculation!.salesCommission), 0),
    cogs: withCalc.reduce((s, e) => s + Number(e.calculation!.cogs), 0),
    expenses: withCalc.reduce((s, e) => s + Number(e.calculation!.expenseTotal), 0),
  };

  const roleHours = new Map<string, number>();
  for (const e of active) {
    for (const r of e.resources) {
      roleHours.set(r.roleName, (roleHours.get(r.roleName) ?? 0) + Number(r.hours));
    }
  }
  const resourceBreakdown = [...roleHours.entries()]
    .map(([role, hours]) => ({ role, hours }))
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 12);

  const marginTrend = monthlyRevenue.map(({ month }) => {
    const monthEstimates = withCalc.filter((e) => {
      const d = e.expectedDelivery ?? e.createdAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return key === month;
    });
    return {
      month,
      marginPct: avg(monthEstimates.map((e) => Number(e.calculation!.grossMarginPct))),
    };
  });

  return {
    kpis: {
      totalEstimates: active.length,
      wonDeals: won.length,
      lostDeals: lost.length,
      averageMargin: avg(margins),
      averageSellingPrice: avg(prices),
      averageDevelopmentCost: avg(costs),
      averageProjectDuration: avg(durations),
      revenuePipeline,
      monthlyEstimatedRevenue: monthlyRevenue.at(-1)?.revenue ?? 0,
      resourceUtilization,
      marginDistribution,
    },
    charts: {
      monthlyRevenue,
      marginTrend,
      costBreakdown,
      resourceBreakdown,
      dealStatus,
      marginDistribution,
    },
  };
}
