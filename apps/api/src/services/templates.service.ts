import { Prisma, ResourceLocation } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';

export interface TemplateRoleInput {
  roleId: string;
  location: ResourceLocation;
  defaultHours: number;
  billRateOverride?: number | null;
  costRateOverride?: number | null;
}

export interface TemplatePayload {
  name: string;
  slug?: string;
  description?: string;
  commissionRate: number;
  cogsRate: number;
  defaultSubcontractor?: number;
  defaultDevServerCost?: number;
  defaultMargin?: number | null;
  defaultRiskPct?: number | null;
  defaultContingencyPct?: number | null;
  defaultQaPct?: number | null;
  defaultPmPct?: number | null;
  defaultInfrastructurePct?: number | null;
  defaultSprintCount?: number;
  defaultSprintWeeks?: number;
  sprintPaymentPlan?: Array<{ name: string; percentage: number }> | null;
  isActive?: boolean;
  roles?: TemplateRoleInput[];
}

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

const templateInclude = {
  roles: {
    include: { role: true },
    orderBy: { sortOrder: 'asc' as const },
  },
};

export async function listTemplates(includeInactive = false) {
  return prisma.serviceTemplate.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: templateInclude,
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getTemplate(idOrSlug: string) {
  const tpl = await prisma.serviceTemplate.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: templateInclude,
  });
  if (!tpl) throw new AppError('Template not found', 404);
  return tpl;
}

async function replaceRoles(templateId: string, roles: TemplateRoleInput[] = []) {
  await prisma.templateRole.deleteMany({ where: { templateId } });
  if (!roles.length) return;
  await prisma.templateRole.createMany({
    data: roles.map((r, i) => ({
      templateId,
      roleId: r.roleId,
      location: r.location,
      defaultHours: new Prisma.Decimal(r.defaultHours ?? 0),
      billRateOverride:
        r.billRateOverride != null ? new Prisma.Decimal(r.billRateOverride) : null,
      costRateOverride:
        r.costRateOverride != null ? new Prisma.Decimal(r.costRateOverride) : null,
      sortOrder: i,
    })),
  });
}

export async function createTemplate(data: TemplatePayload) {
  const slug = data.slug || slugify(data.name);
  const existing = await prisma.serviceTemplate.findUnique({ where: { slug } });
  if (existing) throw new AppError('Template slug already exists', 409);

  const tpl = await prisma.serviceTemplate.create({
    data: {
      name: data.name,
      slug,
      description: data.description,
      commissionRate: data.commissionRate,
      cogsRate: data.cogsRate,
      defaultSubcontractor: data.defaultSubcontractor ?? 0,
      defaultDevServerCost: data.defaultDevServerCost ?? 0,
      defaultMargin: data.defaultMargin ?? 0.5,
      defaultRiskPct: data.defaultRiskPct,
      defaultContingencyPct: data.defaultContingencyPct,
      defaultQaPct: data.defaultQaPct,
      defaultPmPct: data.defaultPmPct,
      defaultInfrastructurePct: data.defaultInfrastructurePct,
      defaultSprintCount: data.defaultSprintCount ?? 10,
      defaultSprintWeeks: data.defaultSprintWeeks ?? 2,
      sprintPaymentPlan: (data.sprintPaymentPlan as any) ?? undefined,
      isActive: data.isActive ?? true,
    },
  });

  await replaceRoles(tpl.id, data.roles);
  return getTemplate(tpl.id);
}

export async function updateTemplate(id: string, data: TemplatePayload) {
  const existing = await prisma.serviceTemplate.findUnique({ where: { id } });
  if (!existing) throw new AppError('Template not found', 404);

  if (data.slug && data.slug !== existing.slug) {
    const clash = await prisma.serviceTemplate.findUnique({ where: { slug: data.slug } });
    if (clash) throw new AppError('Template slug already exists', 409);
  }

  await prisma.serviceTemplate.update({
    where: { id },
    data: {
      name: data.name,
      slug: data.slug || existing.slug,
      description: data.description,
      commissionRate: data.commissionRate,
      cogsRate: data.cogsRate,
      defaultSubcontractor: data.defaultSubcontractor ?? 0,
      defaultDevServerCost: data.defaultDevServerCost ?? 0,
      defaultMargin: data.defaultMargin,
      defaultRiskPct: data.defaultRiskPct,
      defaultContingencyPct: data.defaultContingencyPct,
      defaultQaPct: data.defaultQaPct,
      defaultPmPct: data.defaultPmPct,
      defaultInfrastructurePct: data.defaultInfrastructurePct,
      defaultSprintCount: data.defaultSprintCount ?? 10,
      defaultSprintWeeks: data.defaultSprintWeeks ?? 2,
      sprintPaymentPlan: (data.sprintPaymentPlan as any) ?? Prisma.JsonNull,
      isActive: data.isActive ?? true,
    },
  });

  if (data.roles) {
    await replaceRoles(id, data.roles);
  }

  return getTemplate(id);
}

export async function deleteTemplate(id: string) {
  const inUse = await prisma.estimate.count({ where: { templateId: id } });
  if (inUse > 0) {
    // Soft-delete when referenced
    return prisma.serviceTemplate.update({
      where: { id },
      data: { isActive: false },
    });
  }
  await prisma.templateRole.deleteMany({ where: { templateId: id } });
  return prisma.serviceTemplate.delete({ where: { id } });
}
