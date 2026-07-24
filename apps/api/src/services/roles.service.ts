import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';
import type { ResourceLocation } from '@prisma/client';

export async function listRoles(includeInactive = false) {
  return prisma.employeeRole.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: { currency: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function createRole(data: {
  name: string;
  slug: string;
  hourlyCostRate: number;
  hourlyBillingRate: number;
  currencyId?: string;
  defaultLocation?: ResourceLocation;
  sortOrder?: number;
}) {
  const existing = await prisma.employeeRole.findFirst({
    where: { OR: [{ slug: data.slug }, { name: data.name }] },
  });
  if (existing) throw new AppError('Role already exists', 409);
  return prisma.employeeRole.create({ data });
}

export async function updateRole(
  id: string,
  data: Partial<{
    name: string;
    hourlyCostRate: number;
    hourlyBillingRate: number;
    currencyId: string | null;
    defaultLocation: ResourceLocation;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  return prisma.employeeRole.update({ where: { id }, data });
}
