import { PrismaClient, UserRole, ResourceLocation, ExpenseCategory, EstimateStatus, Complexity } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { calculateEstimate, DEFAULT_CALC_SETTINGS } from '../src/calculation/engine.js';

const prisma = new PrismaClient();

async function upsertSetting(
  key: string,
  value: string,
  label: string,
  category: string,
  dataType = 'number',
  description?: string,
) {
  return prisma.globalSetting.upsert({
    where: { key },
    update: { value, label, category, dataType, description },
    create: { key, value, label, category, dataType, description },
  });
}

async function main() {
  const existingAdmin = await prisma.user.findUnique({ where: { email: 'admin@estimation.local' } });
  if (existingAdmin) {
    console.log('Database already seeded, skipping.');
    return;
  }

  console.log('Seeding database...');

  const usd = await prisma.currency.upsert({
    where: { code: 'USD' },
    update: {},
    create: { code: 'USD', name: 'US Dollar', symbol: '$' },
  });
  await prisma.currency.upsert({
    where: { code: 'EUR' },
    update: {},
    create: { code: 'EUR', name: 'Euro', symbol: '€' },
  });
  await prisma.currency.upsert({
    where: { code: 'GBP' },
    update: {},
    create: { code: 'GBP', name: 'British Pound', symbol: '£' },
  });
  await prisma.currency.upsert({
    where: { code: 'PKR' },
    update: {},
    create: { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
  });

  const countries = [
    { code: 'US', name: 'United States' },
    { code: 'GB', name: 'United Kingdom' },
    { code: 'CA', name: 'Canada' },
    { code: 'AE', name: 'United Arab Emirates' },
    { code: 'PK', name: 'Pakistan' },
    { code: 'IN', name: 'India' },
    { code: 'AU', name: 'Australia' },
    { code: 'DE', name: 'Germany' },
  ];
  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.code },
      update: { name: c.name },
      create: c,
    });
  }

  const passwordHash = await bcrypt.hash('Password123!', 10);
  const users = [
    { email: 'admin@estimation.local', firstName: 'Ada', lastName: 'Admin', role: UserRole.ADMIN },
    { email: 'sales@estimation.local', firstName: 'Sam', lastName: 'Sales', role: UserRole.SALES },
    { email: 'architect@estimation.local', firstName: 'Alex', lastName: 'Architect', role: UserRole.SOLUTION_ARCHITECT },
    { email: 'delivery@estimation.local', firstName: 'Dana', lastName: 'Delivery', role: UserRole.DELIVERY_MANAGER },
    { email: 'finance@estimation.local', firstName: 'Finn', lastName: 'Finance', role: UserRole.FINANCE },
    { email: 'viewer@estimation.local', firstName: 'Vera', lastName: 'Viewer', role: UserRole.READ_ONLY },
  ];

  const userMap: Record<string, string> = {};
  for (const u of users) {
    const row = await prisma.user.upsert({
      where: { email: u.email },
      update: { firstName: u.firstName, lastName: u.lastName, role: u.role, passwordHash, isActive: true },
      create: { ...u, passwordHash },
    });
    userMap[u.email] = row.id;
  }

  // Settings from Excel/HTML + configurable globals
  const settings: Array<[string, string, string, string, string?]> = [
    ['target_margin', '0.5', 'Company Target Margin', 'margins', '50% target gross margin'],
    ['tax_pct', '0', 'Taxes %', 'financial'],
    ['commission_pct', '0.04', 'Default Commission %', 'financial'],
    ['infrastructure_pct', '0.02', 'Infrastructure %', 'financial'],
    ['contingency_pct', '0.05', 'Contingency %', 'risk'],
    ['risk_pct', '0.05', 'Risk %', 'risk'],
    ['overhead_pct', '0.03', 'Overhead %', 'financial'],
    ['profit_pct', '0.5', 'Profit %', 'margins'],
    ['cogs_pct', '0.036', 'Default COGS %', 'financial'],
    ['support_pct', '0.01', 'Support Cost %', 'financial'],
    ['warranty_pct', '0.01', 'Warranty Cost %', 'financial'],
    ['maintenance_pct', '0.02', 'Maintenance Cost %', 'financial'],
    ['currency', 'USD', 'Default Currency', 'general', 'string'],
    ['working_hours_per_day', '8', 'Working Hours Per Day', 'capacity'],
    ['working_days_per_month', '22', 'Working Days Per Month', 'capacity'],
    ['inflation_pct', '0.03', 'Inflation %', 'financial'],
    ['exchange_rate', '1', 'Exchange Rate', 'financial'],
    ['market_onshore_rate', '150', 'Market Onshore Hourly Rate', 'market'],
    ['market_offshore_rate', '35', 'Market Offshore Hourly Rate', 'market'],
    ['margin_green_threshold', '50', 'Margin Health Green ≥', 'margins'],
    ['margin_yellow_threshold', '40', 'Margin Health Yellow ≥', 'margins'],
  ];
  for (const [key, value, label, category, description] of settings) {
    const dataType = key === 'currency' ? 'string' : 'number';
    await upsertSetting(key, value, label, category, dataType, description);
  }

  await prisma.paymentTerm.deleteMany();
  await prisma.paymentTerm.createMany({
    data: [
      { label: 'Projects < $4k', minAmount: 0, maxAmount: 3999.99, warrantyDays: 7, terms: 'Net 3 Days', sortOrder: 1 },
      { label: 'Projects $4k–$10k', minAmount: 4000, maxAmount: 10999.99, warrantyDays: 15, terms: 'Net 7 Days', sortOrder: 2 },
      { label: 'Projects $11k–$30k', minAmount: 11000, maxAmount: 29999.99, warrantyDays: 30, terms: 'Net 7 Days', sortOrder: 3 },
      { label: 'Projects > $30k', minAmount: 30000, maxAmount: null, warrantyDays: 45, terms: 'Net 14 Days', sortOrder: 4 },
    ],
  });

  // Roles from Excel/HTML + expanded catalog
  const roles = [
    { name: 'Solution Architect', slug: 'solution-architect', cost: 35, bill: 100, loc: ResourceLocation.ONSHORE, order: 1 },
    { name: 'Business Analyst', slug: 'business-analyst', cost: 0, bill: 0, loc: ResourceLocation.OFFSHORE, order: 2 },
    { name: 'UI Designer', slug: 'ui-designer', cost: 10, bill: 40, loc: ResourceLocation.OFFSHORE, order: 3 },
    { name: 'UX Designer', slug: 'ux-designer', cost: 10, bill: 40, loc: ResourceLocation.OFFSHORE, order: 4 },
    { name: 'Creative Design', slug: 'creative-design', cost: 10, bill: 40, loc: ResourceLocation.OFFSHORE, order: 5 },
    { name: 'Frontend Developer', slug: 'frontend-developer', cost: 8, bill: 45, loc: ResourceLocation.OFFSHORE, order: 6 },
    { name: 'Backend Developer', slug: 'backend-developer', cost: 8, bill: 45, loc: ResourceLocation.OFFSHORE, order: 7 },
    { name: 'Full Stack Developer', slug: 'full-stack-developer', cost: 8, bill: 45, loc: ResourceLocation.OFFSHORE, order: 8 },
    { name: 'Code Development', slug: 'code-development', cost: 8, bill: 45, loc: ResourceLocation.OFFSHORE, order: 9 },
    { name: 'Mobile Developer', slug: 'mobile-developer', cost: 8, bill: 45, loc: ResourceLocation.OFFSHORE, order: 10 },
    { name: 'QA', slug: 'qa', cost: 8, bill: 38, loc: ResourceLocation.OFFSHORE, order: 11 },
    { name: 'Quality Assurance', slug: 'quality-assurance', cost: 8, bill: 38, loc: ResourceLocation.OFFSHORE, order: 12 },
    { name: 'DevOps', slug: 'devops', cost: 8, bill: 38, loc: ResourceLocation.OFFSHORE, order: 13 },
    { name: 'DevOps / IT Support', slug: 'devops-it-support', cost: 8, bill: 38, loc: ResourceLocation.OFFSHORE, order: 14 },
    { name: 'AI Engineer', slug: 'ai-engineer', cost: 12, bill: 55, loc: ResourceLocation.OFFSHORE, order: 15 },
    { name: 'Project Manager', slug: 'project-manager', cost: 14, bill: 35, loc: ResourceLocation.OFFSHORE, order: 16 },
    { name: 'Project Management', slug: 'project-management', cost: 14, bill: 35, loc: ResourceLocation.OFFSHORE, order: 17 },
    { name: 'Product Owner', slug: 'product-owner', cost: 21, bill: 45, loc: ResourceLocation.OFFSHORE, order: 18 },
    { name: 'Account Management', slug: 'account-management', cost: 21, bill: 35, loc: ResourceLocation.OFFSHORE, order: 19 },
    { name: 'Account Manager', slug: 'account-manager', cost: 35, bill: 35, loc: ResourceLocation.ONSHORE, order: 20 },
    { name: 'Marketing', slug: 'marketing', cost: 9, bill: 42, loc: ResourceLocation.OFFSHORE, order: 21 },
    { name: 'Digital Marketing', slug: 'digital-marketing', cost: 9, bill: 42, loc: ResourceLocation.OFFSHORE, order: 22 },
    { name: 'SEO', slug: 'seo', cost: 8, bill: 42, loc: ResourceLocation.OFFSHORE, order: 23 },
    { name: 'Search Engine Optimization', slug: 'search-engine-optimization', cost: 8, bill: 42, loc: ResourceLocation.OFFSHORE, order: 24 },
    { name: 'PPC', slug: 'ppc', cost: 9, bill: 50, loc: ResourceLocation.OFFSHORE, order: 25 },
    { name: 'Pay Per Click', slug: 'pay-per-click', cost: 9, bill: 50, loc: ResourceLocation.OFFSHORE, order: 26 },
    { name: 'Content Writer', slug: 'content-writer', cost: 6, bill: 42, loc: ResourceLocation.OFFSHORE, order: 27 },
    { name: 'Content Writing', slug: 'content-writing', cost: 6, bill: 42, loc: ResourceLocation.OFFSHORE, order: 28 },
    { name: 'Email Marketing', slug: 'email-marketing', cost: 21, bill: 42, loc: ResourceLocation.OFFSHORE, order: 29 },
    { name: 'Social Media Management', slug: 'social-media-management', cost: 14, bill: 42, loc: ResourceLocation.OFFSHORE, order: 30 },
    { name: 'Data Entry', slug: 'data-entry', cost: 6, bill: 10, loc: ResourceLocation.OFFSHORE, order: 31 },
    { name: 'Support', slug: 'support', cost: 8, bill: 25, loc: ResourceLocation.OFFSHORE, order: 32 },
    { name: 'Support Manager', slug: 'support-manager', cost: 14, bill: 35, loc: ResourceLocation.OFFSHORE, order: 33 },
    { name: 'Executive Management', slug: 'executive-management', cost: 35, bill: 35, loc: ResourceLocation.ONSHORE, order: 34 },
  ];

  const roleIds: Record<string, string> = {};
  for (const r of roles) {
    const row = await prisma.employeeRole.upsert({
      where: { slug: r.slug },
      update: {
        name: r.name,
        hourlyCostRate: r.cost,
        hourlyBillingRate: r.bill,
        defaultLocation: r.loc,
        currencyId: usd.id,
        sortOrder: r.order,
        isActive: true,
      },
      create: {
        name: r.name,
        slug: r.slug,
        hourlyCostRate: r.cost,
        hourlyBillingRate: r.bill,
        defaultLocation: r.loc,
        currencyId: usd.id,
        sortOrder: r.order,
      },
    });
    roleIds[r.slug] = row.id;
  }

  type TRole = { slug: string; location: ResourceLocation; hours?: number; bill?: number; cost?: number };
  const templates: Array<{
    name: string;
    slug: string;
    description: string;
    commissionRate: number;
    cogsRate: number;
    defaultSubcontractor: number;
    defaultDevServerCost: number;
    roles: TRole[];
  }> = [
    {
      name: 'Web CMS',
      slug: 'web-cms',
      description: 'Website / CMS development (from Excel Web CMS)',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 35000,
      defaultDevServerCost: 60,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE, bill: 100, cost: 35 },
        { slug: 'account-management', location: ResourceLocation.ONSHORE, bill: 35, cost: 35 },
        { slug: 'business-analyst', location: ResourceLocation.OFFSHORE },
        { slug: 'code-development', location: ResourceLocation.OFFSHORE, bill: 45, cost: 8, hours: 460 },
        { slug: 'creative-design', location: ResourceLocation.OFFSHORE, bill: 40, cost: 10, hours: 250 },
        { slug: 'digital-marketing', location: ResourceLocation.OFFSHORE, bill: 42, cost: 9 },
        { slug: 'account-management', location: ResourceLocation.OFFSHORE, bill: 35, cost: 21 },
        { slug: 'data-entry', location: ResourceLocation.OFFSHORE, bill: 10, cost: 6 },
        { slug: 'project-management', location: ResourceLocation.OFFSHORE, bill: 35, cost: 14 },
        { slug: 'quality-assurance', location: ResourceLocation.OFFSHORE, bill: 38, cost: 8 },
        { slug: 'devops-it-support', location: ResourceLocation.OFFSHORE, bill: 38, cost: 8 },
      ],
    },
    {
      name: 'Web Retainer',
      slug: 'web-retainer',
      description: 'Ongoing web retainer (from Excel Web Retainer)',
      commissionRate: 0.02,
      cogsRate: 0.018,
      defaultSubcontractor: 0,
      defaultDevServerCost: 0,
      roles: [
        { slug: 'executive-management', location: ResourceLocation.ONSHORE, bill: 35, cost: 35 },
        { slug: 'account-management', location: ResourceLocation.ONSHORE, bill: 35, cost: 35 },
        { slug: 'code-development', location: ResourceLocation.OFFSHORE, bill: 40, cost: 8 },
        { slug: 'creative-design', location: ResourceLocation.OFFSHORE, bill: 40, cost: 10 },
        { slug: 'account-management', location: ResourceLocation.OFFSHORE, bill: 32, cost: 21 },
        { slug: 'project-management', location: ResourceLocation.OFFSHORE, bill: 32, cost: 14 },
        { slug: 'quality-assurance', location: ResourceLocation.OFFSHORE, bill: 38, cost: 8 },
        { slug: 'devops-it-support', location: ResourceLocation.OFFSHORE, bill: 38, cost: 8 },
      ],
    },
    {
      name: 'Full Stack Development',
      slug: 'full-stack-development',
      description: 'Full stack application development (from Excel FSD)',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 45000,
      defaultDevServerCost: 0,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE, bill: 65, cost: 35 },
        { slug: 'account-management', location: ResourceLocation.ONSHORE, bill: 35, cost: 35 },
        { slug: 'code-development', location: ResourceLocation.OFFSHORE, bill: 45, cost: 8 },
        { slug: 'creative-design', location: ResourceLocation.OFFSHORE, bill: 35, cost: 10 },
        { slug: 'account-management', location: ResourceLocation.OFFSHORE, bill: 35, cost: 21 },
        { slug: 'data-entry', location: ResourceLocation.OFFSHORE, bill: 15, cost: 6 },
        { slug: 'project-management', location: ResourceLocation.OFFSHORE, bill: 35, cost: 14 },
        { slug: 'quality-assurance', location: ResourceLocation.OFFSHORE, bill: 40, cost: 8 },
        { slug: 'devops-it-support', location: ResourceLocation.OFFSHORE, bill: 40, cost: 8 },
      ],
    },
    {
      name: 'Digital Marketing',
      slug: 'digital-marketing',
      description: 'Digital marketing retainer / campaign (from Excel)',
      commissionRate: 0.02,
      cogsRate: 0.018,
      defaultSubcontractor: 0,
      defaultDevServerCost: 0,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE, bill: 50, cost: 35 },
        { slug: 'account-management', location: ResourceLocation.ONSHORE, bill: 35, cost: 35 },
        { slug: 'search-engine-optimization', location: ResourceLocation.OFFSHORE, bill: 42, cost: 8, hours: 15 },
        { slug: 'pay-per-click', location: ResourceLocation.OFFSHORE, bill: 50, cost: 9, hours: 15 },
        { slug: 'email-marketing', location: ResourceLocation.OFFSHORE, bill: 42, cost: 21, hours: 10 },
        { slug: 'creative-design', location: ResourceLocation.OFFSHORE, bill: 45, cost: 10, hours: 20 },
        { slug: 'content-writing', location: ResourceLocation.OFFSHORE, bill: 42, cost: 6, hours: 20 },
        { slug: 'social-media-management', location: ResourceLocation.OFFSHORE, bill: 42, cost: 14, hours: 10 },
        { slug: 'project-management', location: ResourceLocation.OFFSHORE, bill: 35, cost: 8, hours: 10 },
        { slug: 'account-management', location: ResourceLocation.OFFSHORE, bill: 35, cost: 8, hours: 2 },
      ],
    },
    {
      name: 'Website',
      slug: 'website',
      description: 'Marketing / brochure website',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 15000,
      defaultDevServerCost: 40,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE },
        { slug: 'ui-designer', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'frontend-developer', location: ResourceLocation.OFFSHORE, hours: 120 },
        { slug: 'backend-developer', location: ResourceLocation.OFFSHORE, hours: 80 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 40 },
      ],
    },
    {
      name: 'Mobile App',
      slug: 'mobile-app',
      description: 'Native / cross-platform mobile application',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 25000,
      defaultDevServerCost: 0,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE },
        { slug: 'ux-designer', location: ResourceLocation.OFFSHORE, hours: 60 },
        { slug: 'mobile-developer', location: ResourceLocation.OFFSHORE, hours: 320 },
        { slug: 'backend-developer', location: ResourceLocation.OFFSHORE, hours: 160 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 80 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 60 },
      ],
    },
    {
      name: 'AI Project',
      slug: 'ai-project',
      description: 'AI / ML product or integration',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 20000,
      defaultDevServerCost: 200,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE },
        { slug: 'ai-engineer', location: ResourceLocation.OFFSHORE, hours: 200 },
        { slug: 'backend-developer', location: ResourceLocation.OFFSHORE, hours: 120 },
        { slug: 'frontend-developer', location: ResourceLocation.OFFSHORE, hours: 80 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 40 },
      ],
    },
    {
      name: 'SaaS Product',
      slug: 'saas-product',
      description: 'Multi-tenant SaaS MVP / product build',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 40000,
      defaultDevServerCost: 150,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE },
        { slug: 'product-owner', location: ResourceLocation.OFFSHORE, hours: 80 },
        { slug: 'full-stack-developer', location: ResourceLocation.OFFSHORE, hours: 400 },
        { slug: 'devops', location: ResourceLocation.OFFSHORE, hours: 80 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 100 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 80 },
      ],
    },
    {
      name: 'MVP',
      slug: 'mvp',
      description: 'Lean MVP for validation',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 10000,
      defaultDevServerCost: 50,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE, hours: 20 },
        { slug: 'full-stack-developer', location: ResourceLocation.OFFSHORE, hours: 200 },
        { slug: 'ui-designer', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 30 },
      ],
    },
    {
      name: 'Ecommerce',
      slug: 'ecommerce',
      description: 'Ecommerce storefront and integrations',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 30000,
      defaultDevServerCost: 80,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE },
        { slug: 'frontend-developer', location: ResourceLocation.OFFSHORE, hours: 160 },
        { slug: 'backend-developer', location: ResourceLocation.OFFSHORE, hours: 160 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 60 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 50 },
      ],
    },
    {
      name: 'Healthcare',
      slug: 'healthcare',
      description: 'Healthcare / compliance-sensitive build',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 35000,
      defaultDevServerCost: 100,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE, hours: 40 },
        { slug: 'business-analyst', location: ResourceLocation.OFFSHORE, hours: 80 },
        { slug: 'full-stack-developer', location: ResourceLocation.OFFSHORE, hours: 300 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 100 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 80 },
      ],
    },
    {
      name: 'CRM',
      slug: 'crm',
      description: 'CRM implementation / customization',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 20000,
      defaultDevServerCost: 40,
      roles: [
        { slug: 'business-analyst', location: ResourceLocation.OFFSHORE, hours: 60 },
        { slug: 'full-stack-developer', location: ResourceLocation.OFFSHORE, hours: 200 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 40 },
      ],
    },
    {
      name: 'ERP',
      slug: 'erp',
      description: 'ERP implementation / integration',
      commissionRate: 0.04,
      cogsRate: 0.036,
      defaultSubcontractor: 50000,
      defaultDevServerCost: 120,
      roles: [
        { slug: 'solution-architect', location: ResourceLocation.ONSHORE, hours: 60 },
        { slug: 'business-analyst', location: ResourceLocation.OFFSHORE, hours: 120 },
        { slug: 'backend-developer', location: ResourceLocation.OFFSHORE, hours: 300 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 100 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 100 },
      ],
    },
    {
      name: 'Support',
      slug: 'support',
      description: 'Support retainer',
      commissionRate: 0.02,
      cogsRate: 0.018,
      defaultSubcontractor: 0,
      defaultDevServerCost: 0,
      roles: [
        { slug: 'support', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'devops', location: ResourceLocation.OFFSHORE, hours: 10 },
        { slug: 'account-manager', location: ResourceLocation.ONSHORE, hours: 4 },
      ],
    },
    {
      name: 'Maintenance',
      slug: 'maintenance',
      description: 'Application maintenance package',
      commissionRate: 0.02,
      cogsRate: 0.018,
      defaultSubcontractor: 0,
      defaultDevServerCost: 40,
      roles: [
        { slug: 'full-stack-developer', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'qa', location: ResourceLocation.OFFSHORE, hours: 10 },
        { slug: 'devops', location: ResourceLocation.OFFSHORE, hours: 10 },
        { slug: 'project-manager', location: ResourceLocation.OFFSHORE, hours: 8 },
      ],
    },
    {
      name: 'Marketing',
      slug: 'marketing',
      description: 'General marketing services package',
      commissionRate: 0.02,
      cogsRate: 0.018,
      defaultSubcontractor: 0,
      defaultDevServerCost: 0,
      roles: [
        { slug: 'marketing', location: ResourceLocation.OFFSHORE, hours: 40 },
        { slug: 'content-writer', location: ResourceLocation.OFFSHORE, hours: 20 },
        { slug: 'seo', location: ResourceLocation.OFFSHORE, hours: 20 },
        { slug: 'ppc', location: ResourceLocation.OFFSHORE, hours: 20 },
      ],
    },
  ];

  for (const t of templates) {
    const tpl = await prisma.serviceTemplate.upsert({
      where: { slug: t.slug },
      update: {
        name: t.name,
        description: t.description,
        commissionRate: t.commissionRate,
        cogsRate: t.cogsRate,
        defaultSubcontractor: t.defaultSubcontractor,
        defaultDevServerCost: t.defaultDevServerCost,
        defaultMargin: 0.5,
        isActive: true,
      },
      create: {
        name: t.name,
        slug: t.slug,
        description: t.description,
        commissionRate: t.commissionRate,
        cogsRate: t.cogsRate,
        defaultSubcontractor: t.defaultSubcontractor,
        defaultDevServerCost: t.defaultDevServerCost,
        defaultMargin: 0.5,
        defaultRiskPct: 0.05,
        defaultContingencyPct: 0.05,
        defaultQaPct: 0.15,
        defaultPmPct: 0.1,
        defaultInfrastructurePct: 0.02,
      },
    });

    await prisma.templateRole.deleteMany({ where: { templateId: tpl.id } });
    let sort = 0;
    for (const tr of t.roles) {
      const roleId = roleIds[tr.slug];
      if (!roleId) continue;
      await prisma.templateRole.create({
        data: {
          templateId: tpl.id,
          roleId,
          location: tr.location,
          defaultHours: tr.hours ?? 0,
          billRateOverride: tr.bill ?? null,
          costRateOverride: tr.cost ?? null,
          sortOrder: sort++,
        },
      });
    }
  }

  const us = await prisma.country.findUniqueOrThrow({ where: { code: 'US' } });
  const ae = await prisma.country.findUniqueOrThrow({ where: { code: 'AE' } });

  const clientAcme = await prisma.client.upsert({
    where: { id: 'seed-client-acme' },
    update: {},
    create: {
      id: 'seed-client-acme',
      name: 'Acme Retail Group',
      industry: 'Ecommerce',
      countryId: us.id,
      currencyId: usd.id,
      salesPersonId: userMap['sales@estimation.local'],
      accountManagerId: userMap['delivery@estimation.local'],
      notes: 'Sample ecommerce client',
    },
  });

  const clientNova = await prisma.client.upsert({
    where: { id: 'seed-client-nova' },
    update: {},
    create: {
      id: 'seed-client-nova',
      name: 'Nova Health Clinics',
      industry: 'Healthcare',
      countryId: ae.id,
      currencyId: usd.id,
      salesPersonId: userMap['sales@estimation.local'],
      accountManagerId: userMap['architect@estimation.local'],
      notes: 'Sample healthcare client',
    },
  });

  const webCms = await prisma.serviceTemplate.findUniqueOrThrow({ where: { slug: 'web-cms' } });
  const existingEstimate = await prisma.estimate.findUnique({ where: { estimateNumber: 'EST-2026-0001' } });

  if (!existingEstimate) {
    const resources = [
      { roleName: 'Code Development', location: ResourceLocation.OFFSHORE, hours: 460, hourlyCost: 8, hourlyBilling: 45 },
      { roleName: 'Creative Design', location: ResourceLocation.OFFSHORE, hours: 250, hourlyCost: 10, hourlyBilling: 40 },
      { roleName: 'Digital Marketing', location: ResourceLocation.OFFSHORE, hours: 8, hourlyCost: 9, hourlyBilling: 42 },
      { roleName: 'Account Management', location: ResourceLocation.OFFSHORE, hours: 8, hourlyCost: 21, hourlyBilling: 35 },
      { roleName: 'Data Entry', location: ResourceLocation.OFFSHORE, hours: 15, hourlyCost: 6, hourlyBilling: 10 },
    ].map((r, i) => ({
      ...r,
      totalCost: r.hours * r.hourlyCost,
      totalRevenue: r.hours * r.hourlyBilling,
      sortOrder: i,
      roleId: roleIds[r.roleName.toLowerCase().replace(/ \/ /g, '-').replace(/ /g, '-')] ?? roleIds['code-development'],
    }));

    // fix role ids
    resources[0].roleId = roleIds['code-development'];
    resources[1].roleId = roleIds['creative-design'];
    resources[2].roleId = roleIds['digital-marketing'];
    resources[3].roleId = roleIds['account-management'];
    resources[4].roleId = roleIds['data-entry'];

    const expenses = [
      { category: ExpenseCategory.SUBCONTRACTOR, name: 'Sub-Contractor', amount: 35000, sortOrder: 0 },
      { category: ExpenseCategory.DEV_SERVER, name: 'Dev Server Cost', amount: 60, sortOrder: 1, isRecurring: true },
    ];

    const paymentTerms = await prisma.paymentTerm.findMany({ orderBy: { sortOrder: 'asc' } });
    const calc = calculateEstimate({
      resources: resources.map((r) => ({
        roleName: r.roleName,
        location: r.location,
        hours: r.hours,
        hourlyCost: r.hourlyCost,
        hourlyBilling: r.hourlyBilling,
      })),
      expenses: expenses.map((e) => ({
        category: e.category,
        name: e.name,
        amount: Number(e.amount),
        isRecurring: e.isRecurring,
      })),
      negotiatedPrice: 101000,
      settings: {
        ...DEFAULT_CALC_SETTINGS,
        commissionRate: Number(webCms.commissionRate),
        cogsRate: Number(webCms.cogsRate),
      },
      paymentTerms: paymentTerms.map((p) => ({
        label: p.label,
        minAmount: Number(p.minAmount),
        maxAmount: p.maxAmount != null ? Number(p.maxAmount) : null,
        warrantyDays: p.warrantyDays,
        terms: p.terms,
      })),
    });

    const estimate = await prisma.estimate.create({
      data: {
        estimateNumber: 'EST-2026-0001',
        projectName: 'Acme CMS Relaunch',
        description: 'Sample Web CMS estimate migrated from calculator defaults',
        clientId: clientAcme.id,
        templateId: webCms.id,
        complexity: Complexity.MEDIUM,
        status: EstimateStatus.APPROVED,
        currencyId: usd.id,
        negotiatedPrice: 101000,
        recommendedPrice: calc.recommendedPrice,
        createdById: userMap['architect@estimation.local'],
        startDate: new Date('2026-08-01'),
        expectedDelivery: new Date('2026-11-30'),
        resources: { create: resources },
        expenses: { create: expenses },
        calculation: {
          create: {
            totalHours: calc.totalHours,
            labourCost: calc.labourCost,
            labourRevenue: calc.labourRevenue,
            salesCommission: calc.salesCommission,
            cogs: calc.cogs,
            expenseTotal: calc.expenseTotal,
            directCosts: calc.directCosts,
            developmentCost: calc.developmentCost,
            operatingCost: calc.operatingCost,
            engagementFee: calc.engagementFee,
            recommendedPrice: calc.recommendedPrice,
            clientPrice: calc.clientPrice,
            grossProfit: calc.grossProfit,
            netProfit: calc.netProfit,
            directMargin: calc.directMargin,
            grossMarginPct: calc.grossMarginPct,
            netMarginPct: calc.netMarginPct,
            targetMarginAmount: calc.targetMarginAmount,
            targetMarginPct: calc.targetMarginPct,
            excessDeficit: calc.excessDeficit,
            markupPct: calc.markupPct,
            discountPct: calc.discountPct,
            breakEven: calc.breakEven,
            weightedHourlyCost: calc.weightedHourlyCost,
            weightedHourlyBilling: calc.weightedHourlyBilling,
            averageTeamCost: calc.averageTeamCost,
            averageTeamBilling: calc.averageTeamBilling,
            apiRate: calc.apiRate,
            marketRate: calc.marketRate,
            riskBuffer: calc.riskBuffer,
            contingencyBuffer: calc.contingencyBuffer,
            infrastructureCost: calc.infrastructureCost,
            supportCost: calc.supportCost,
            warrantyCost: calc.warrantyCost,
            maintenanceCost: calc.maintenanceCost,
            recurringCost: calc.recurringCost,
            monthlyCost: calc.monthlyCost,
            annualCost: calc.annualCost,
            roi: calc.roi,
            marginHealth: calc.marginHealth,
            paymentTermLabel: calc.paymentTermLabel,
            paymentTerms: calc.paymentTerms,
            warrantyDays: calc.warrantyDays,
            recommendations: calc.recommendations,
            cashFlowProjection: calc.cashFlowProjection,
            rawBreakdown: {
              resources: calc.resourceBreakdown,
              expenses: calc.expenseBreakdown,
            },
          },
        },
        versions: {
          create: {
            version: 1,
            changeSummary: 'Initial seeded estimate',
            createdById: userMap['architect@estimation.local'],
            snapshot: { projectName: 'Acme CMS Relaunch', negotiatedPrice: 101000, calc },
          },
        },
        scenarios: {
          create: [
            {
              name: 'Scenario A — Recommended',
              isWinner: false,
              negotiatedPrice: calc.recommendedPrice,
              resultSnapshot: { margin: calc.grossMarginPct, profit: calc.grossProfit },
            },
            {
              name: 'Scenario B — Negotiated $101k',
              isWinner: true,
              negotiatedPrice: 101000,
              resultSnapshot: { margin: calc.grossMarginPct, profit: calc.grossProfit },
            },
          ],
        },
      },
    });

    await prisma.estimate.create({
      data: {
        estimateNumber: 'EST-2026-0002',
        projectName: 'Nova Patient Portal MVP',
        description: 'Draft MVP estimate for demo pipeline',
        clientId: clientNova.id,
        templateId: (await prisma.serviceTemplate.findUniqueOrThrow({ where: { slug: 'mvp' } })).id,
        complexity: Complexity.HIGH,
        status: EstimateStatus.DRAFT,
        currencyId: usd.id,
        negotiatedPrice: 75000,
        createdById: userMap['sales@estimation.local'],
        resources: {
          create: [
            {
              roleId: roleIds['full-stack-developer'],
              roleName: 'Full Stack Developer',
              location: ResourceLocation.OFFSHORE,
              hours: 200,
              hourlyCost: 8,
              hourlyBilling: 45,
              totalCost: 1600,
              totalRevenue: 9000,
            },
          ],
        },
        expenses: {
          create: [{ category: ExpenseCategory.SUBCONTRACTOR, name: 'Sub-Contractor', amount: 10000 }],
        },
      },
    });

    console.log(`Created sample estimates including ${estimate.estimateNumber}`);
  }

  await prisma.auditLog.create({
    data: {
      userId: userMap['admin@estimation.local'],
      action: 'SEED',
      entityType: 'System',
      metadata: { message: 'Database seeded successfully' },
    },
  });

  console.log('Seed complete.');
  console.log('Demo users (password: Password123!):');
  for (const u of users) console.log(`  ${u.email} (${u.role})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
