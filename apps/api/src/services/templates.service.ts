import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';

export async function listTemplates() {
  return prisma.serviceTemplate.findMany({
    where: { isActive: true },
    include: {
      roles: {
        include: { role: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getTemplate(idOrSlug: string) {
  const tpl = await prisma.serviceTemplate.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    include: {
      roles: { include: { role: true }, orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!tpl) throw new AppError('Template not found', 404);
  return tpl;
}

export async function updateTemplate(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    commissionRate: number;
    cogsRate: number;
    defaultSubcontractor: number;
    defaultDevServerCost: number;
    defaultMargin: number;
    defaultRiskPct: number;
    defaultContingencyPct: number;
    defaultQaPct: number;
    defaultPmPct: number;
    defaultInfrastructurePct: number;
    isActive: boolean;
  }>,
) {
  return prisma.serviceTemplate.update({ where: { id }, data });
}
