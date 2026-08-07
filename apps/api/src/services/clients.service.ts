import { prisma } from '../utils/prisma.js';
import { AppError } from '../utils/errors.js';

export async function listClients() {
  const clients = await prisma.client.findMany({
    where: { isActive: true },
    include: {
      country: true,
      currency: true,
      salesPerson: { select: { id: true, firstName: true, lastName: true, email: true } },
      accountManager: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { estimates: true } },
    },
    orderBy: { name: 'asc' },
  });

  return clients.map((c) => ({
    ...c,
    estimatesCount: c._count.estimates,
  }));
}

export async function getClient(id: string) {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      country: true,
      currency: true,
      salesPerson: { select: { id: true, firstName: true, lastName: true, email: true } },
      accountManager: { select: { id: true, firstName: true, lastName: true, email: true } },
      estimates: {
        include: { calculation: true, template: true },
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
  if (!client) throw new AppError('Client not found', 404);
  return client;
}

export async function createClient(data: {
  name: string;
  industry?: string;
  countryId?: string;
  currencyId?: string;
  salesPersonId?: string;
  accountManagerId?: string;
  notes?: string;
}) {
  return prisma.client.create({ data });
}

export async function updateClient(
  id: string,
  data: Partial<{
    name: string;
    industry: string;
    countryId: string | null;
    currencyId: string | null;
    salesPersonId: string | null;
    accountManagerId: string | null;
    notes: string;
    isActive: boolean;
  }>,
) {
  return prisma.client.update({ where: { id }, data });
}
