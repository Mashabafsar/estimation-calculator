import express, { Router } from 'express';
import { z } from 'zod';
import { config } from '../config/index.js';
import { asyncHandler } from '../utils/errors.js';
import { authenticate, authorize, requireWrite } from '../middleware/auth.js';
import * as authService from '../services/auth.service.js';
import * as settingsService from '../services/settings.service.js';
import * as rolesService from '../services/roles.service.js';
import * as templatesService from '../services/templates.service.js';
import * as clientsService from '../services/clients.service.js';
import * as estimatesService from '../services/estimates.service.js';
import * as dashboardService from '../services/dashboard.service.js';
import * as hoursSourceService from '../services/hoursSource.service.js';
import * as signaturesService from '../services/signatures.service.js';
import * as signatureMedia from '../services/signature-media.service.js';

import {
  ApprovalAction,
  Complexity,
  EstimateStatus,
  ExpenseCategory,
  ResourceLocation,
  UserRole,
} from '@prisma/client';

const router = Router();

const resourceSchema = z.object({
  roleId: z.string().optional(),
  roleName: z.string().min(1),
  location: z.nativeEnum(ResourceLocation),
  hours: z.number().min(0),
  resourceCount: z.number().int().min(1).max(100).optional().default(1),
  hourlyCost: z.number().min(0),
  hourlyBilling: z.number().min(0),
});

const expenseSchema = z.object({
  category: z.nativeEnum(ExpenseCategory),
  name: z.string().min(1),
  amount: z.number().min(0),
  isRecurring: z.boolean().optional(),
  notes: z.string().optional(),
});

const estimateSchema = z.object({
  projectName: z.string().min(1),
  description: z.string().optional(),
  clientId: z.string().optional(),
  templateId: z.string().optional(),
  complexity: z.nativeEnum(Complexity).optional(),
  startDate: z.string().optional(),
  expectedDelivery: z.string().optional(),
  currencyId: z.string().optional(),
  negotiatedPrice: z.number().nullable().optional(),
  sprintCount: z.number().int().min(1).max(60).nullable().optional(),
  sprintWeeks: z.number().int().min(1).max(8).nullable().optional(),
  warrantyPeriodDays: z.number().int().min(0).max(730).nullable().optional(),
  sprintPaymentPlan: z
    .array(z.object({ name: z.string(), percentage: z.number().min(0).max(1) }))
    .nullable()
    .optional(),
  resources: z.array(resourceSchema).default([]),
  expenses: z.array(expenseSchema).default([]),
});

// startDate / expectedDelivery / sprintCount / sprintWeeks kept optional for backward compatibility
// but UI no longer collects them — sprint count is calculated from department hours.

const templateRoleSchema = z.object({
  roleId: z.string().min(1),
  location: z.nativeEnum(ResourceLocation),
  defaultHours: z.number().min(0),
  billRateOverride: z.number().nullable().optional(),
  costRateOverride: z.number().nullable().optional(),
});

const templateSchema = z.object({
  name: z.string().min(1),
  slug: z.string().optional(),
  description: z.string().optional(),
  commissionRate: z.number().min(0).max(1),
  cogsRate: z.number().min(0).max(1),
  defaultSubcontractor: z.number().min(0).optional(),
  defaultDevServerCost: z.number().min(0).optional(),
  defaultMargin: z.number().min(0).max(1).nullable().optional(),
  defaultRiskPct: z.number().min(0).max(1).nullable().optional(),
  defaultContingencyPct: z.number().min(0).max(1).nullable().optional(),
  defaultQaPct: z.number().min(0).max(1).nullable().optional(),
  defaultPmPct: z.number().min(0).max(1).nullable().optional(),
  defaultInfrastructurePct: z.number().min(0).max(1).nullable().optional(),
  defaultSprintCount: z.number().int().min(1).max(30).optional(),
  defaultSprintWeeks: z.number().int().min(1).max(8).optional(),
  sprintPaymentPlan: z
    .array(z.object({ name: z.string(), percentage: z.number().min(0).max(1) }))
    .nullable()
    .optional(),
  isActive: z.boolean().optional(),
  roles: z.array(templateRoleSchema).optional(),
});

// Auth
router.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const body = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
    const result = await authService.login(body.email, body.password);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/auth/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await authService.me(req.user!.id);
    res.json({ success: true, data: user });
  }),
);

router.get(
  '/users',
  authenticate,
  authorize(UserRole.ADMIN),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await authService.listUsers() });
  }),
);

router.post(
  '/users',
  authenticate,
  authorize(UserRole.ADMIN),
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        role: z.nativeEnum(UserRole),
      })
      .parse(req.body);
    res.status(201).json({ success: true, data: await authService.createUser(body) });
  }),
);

// Dashboard
router.get(
  '/dashboard',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await dashboardService.getDashboard() });
  }),
);

// Settings
router.get(
  '/settings',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await settingsService.listSettings() });
  }),
);

router.put(
  '/settings',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.FINANCE),
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ updates: z.array(z.object({ key: z.string(), value: z.string() })) })
      .parse(req.body);
    res.json({ success: true, data: await settingsService.bulkUpdateSettings(body.updates) });
  }),
);

router.get(
  '/settings/payment-terms',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await settingsService.listPaymentTerms() });
  }),
);

router.get(
  '/currencies',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await settingsService.listCurrencies() });
  }),
);

router.get(
  '/countries',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await settingsService.listCountries() });
  }),
);

// Roles
router.get(
  '/roles',
  authenticate,
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === 'true';
    res.json({ success: true, data: await rolesService.listRoles(includeInactive) });
  }),
);

router.post(
  '/roles',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.FINANCE),
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        slug: z.string().min(1),
        hourlyCostRate: z.number(),
        hourlyBillingRate: z.number(),
        currencyId: z.string().optional(),
        defaultLocation: z.nativeEnum(ResourceLocation).optional(),
        sortOrder: z.number().optional(),
      })
      .parse(req.body);
    res.status(201).json({ success: true, data: await rolesService.createRole(body) });
  }),
);

router.patch(
  '/roles/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.FINANCE),
  requireWrite,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await rolesService.updateRole(req.params.id, req.body) });
  }),
);

// Templates
router.get(
  '/templates',
  authenticate,
  asyncHandler(async (req, res) => {
    const includeInactive = req.query.all === 'true';
    res.json({ success: true, data: await templatesService.listTemplates(includeInactive) });
  }),
);

router.get(
  '/templates/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await templatesService.getTemplate(req.params.id) });
  }),
);

router.post(
  '/templates',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SOLUTION_ARCHITECT),
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = templateSchema.parse(req.body);
    res.status(201).json({ success: true, data: await templatesService.createTemplate(body) });
  }),
);

router.put(
  '/templates/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SOLUTION_ARCHITECT),
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = templateSchema.parse(req.body);
    res.json({ success: true, data: await templatesService.updateTemplate(req.params.id, body) });
  }),
);

router.patch(
  '/templates/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SOLUTION_ARCHITECT),
  requireWrite,
  asyncHandler(async (req, res) => {
    const existing = await templatesService.getTemplate(req.params.id);
    const body = templateSchema.parse({
      name: existing.name,
      slug: existing.slug,
      description: existing.description ?? undefined,
      commissionRate: Number(existing.commissionRate),
      cogsRate: Number(existing.cogsRate),
      defaultSubcontractor: Number(existing.defaultSubcontractor),
      defaultDevServerCost: Number(existing.defaultDevServerCost),
      defaultMargin: existing.defaultMargin != null ? Number(existing.defaultMargin) : null,
      defaultRiskPct: existing.defaultRiskPct != null ? Number(existing.defaultRiskPct) : null,
      defaultContingencyPct:
        existing.defaultContingencyPct != null ? Number(existing.defaultContingencyPct) : null,
      defaultQaPct: existing.defaultQaPct != null ? Number(existing.defaultQaPct) : null,
      defaultPmPct: existing.defaultPmPct != null ? Number(existing.defaultPmPct) : null,
      defaultInfrastructurePct:
        existing.defaultInfrastructurePct != null ? Number(existing.defaultInfrastructurePct) : null,
      defaultSprintCount: existing.defaultSprintCount,
      defaultSprintWeeks: existing.defaultSprintWeeks,
      sprintPaymentPlan: existing.sprintPaymentPlan,
      isActive: existing.isActive,
      roles: existing.roles.map((r) => ({
        roleId: r.roleId,
        location: r.location,
        defaultHours: Number(r.defaultHours),
        billRateOverride: r.billRateOverride != null ? Number(r.billRateOverride) : null,
        costRateOverride: r.costRateOverride != null ? Number(r.costRateOverride) : null,
      })),
      ...req.body,
    });
    res.json({ success: true, data: await templatesService.updateTemplate(req.params.id, body) });
  }),
);

router.delete(
  '/templates/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SOLUTION_ARCHITECT),
  requireWrite,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await templatesService.deleteTemplate(req.params.id) });
  }),
);

// Clients
router.get(
  '/clients',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await clientsService.listClients() });
  }),
);

router.get(
  '/clients/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await clientsService.getClient(req.params.id) });
  }),
);

router.post(
  '/clients',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        industry: z.string().optional(),
        countryId: z.string().optional(),
        currencyId: z.string().optional(),
        salesPersonId: z.string().optional(),
        accountManagerId: z.string().optional(),
        notes: z.string().optional(),
      })
      .parse(req.body);
    res.status(201).json({ success: true, data: await clientsService.createClient(body) });
  }),
);

router.patch(
  '/clients/:id',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await clientsService.updateClient(req.params.id, req.body) });
  }),
);

// Estimates
router.post(
  '/estimates/parse-source',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        fileName: z.string().optional(),
        contentBase64: z.string().min(1),
      })
      .parse(req.body);
    const raw = body.contentBase64.includes(',')
      ? body.contentBase64.split(',')[1]
      : body.contentBase64;
    const buffer = Buffer.from(raw, 'base64');
    const data = await hoursSourceService.parseHoursSourceAndMapRoles(buffer);
    res.json({ success: true, data });
  }),
);

router.get(
  '/estimates',
  authenticate,
  asyncHandler(async (req, res) => {
    const status = req.query.status as EstimateStatus | undefined;
    const clientId = req.query.clientId as string | undefined;
    res.json({ success: true, data: await estimatesService.listEstimates({ status, clientId }) });
  }),
);

router.get(
  '/estimates/:id',
  authenticate,
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await estimatesService.getEstimate(req.params.id) });
  }),
);

router.post(
  '/estimates/preview',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = estimateSchema.parse(req.body);
    res.json({ success: true, data: await estimatesService.previewCalculation(body) });
  }),
);

router.post(
  '/estimates',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = estimateSchema.parse(req.body);
    const estimate = await estimatesService.createEstimate(req.user!.id, body);
    res.status(201).json({ success: true, data: estimate });
  }),
);

router.put(
  '/estimates/:id',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = estimateSchema.parse(req.body);
    res.json({ success: true, data: await estimatesService.updateEstimate(req.params.id, req.user!.id, body) });
  }),
);

router.post(
  '/estimates/:id/transition',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = z
      .object({ action: z.nativeEnum(ApprovalAction), comment: z.string().optional() })
      .parse(req.body);
    res.json({
      success: true,
      data: await estimatesService.transitionStatus(req.params.id, req.user!.id, body.action, body.comment),
    });
  }),
);

router.post(
  '/estimates/:id/deal',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.SALES, UserRole.DELIVERY_MANAGER, UserRole.FINANCE),
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = z.object({ outcome: z.enum(['WON', 'LOST']) }).parse(req.body);
    res.json({ success: true, data: await estimatesService.markDeal(req.params.id, req.user!.id, body.outcome) });
  }),
);

router.post(
  '/estimates/:id/scenarios',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = z
      .object({
        name: z.string().min(1),
        negotiatedPrice: z.number().optional(),
        notes: z.string().optional(),
        isWinner: z.boolean().optional(),
      })
      .parse(req.body);
    res.status(201).json({
      success: true,
      data: await estimatesService.addScenario(req.params.id, body),
    });
  }),
);

router.get(
  '/estimates/:id/export',
  authenticate,
  asyncHandler(async (req, res) => {
    const format = (req.query.format as 'json' | 'csv' | 'pdf') || 'json';
    const data = await estimatesService.exportEstimate(req.params.id, format);
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="estimate-${req.params.id}.pdf"`,
      );
      return res.send(data);
    }
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="estimate-${req.params.id}.csv"`);
      return res.send(data);
    }
    res.json({ success: true, data });
  }),
);

const signatureSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  jobTitle: z.string().min(1),
  photoUrl: z.string().optional().nullable(),
  logoUrl: z.string().optional().nullable(),
  directLine: z.string().optional().nullable(),
  cellPhone: z.string().optional().nullable(),
  reportsTo: z.string().optional().nullable(),
  email: z.union([z.string().email(), z.literal('')]).optional().nullable(),
  facebook: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  youtube: z.string().optional().nullable(),
  twitter: z.string().optional().nullable(),
  website2: z.string().optional().nullable(),
  customLinkLabel: z.string().optional().nullable(),
  customLinkUrl: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  companyUrl: z.string().optional().nullable(),
  companyStreet: z.string().optional().nullable(),
  companyCity: z.string().optional().nullable(),
  companyRegion: z.string().optional().nullable(),
  companyPostal: z.string().optional().nullable(),
  tagline: z.string().optional().nullable(),
});

// Email signatures (public share endpoints first)
router.get(
  '/signatures/share/:slug',
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await signaturesService.getByShareSlug(req.params.slug) });
  }),
);

router.get(
  '/signatures/share/:slug/vcard',
  asyncHandler(async (req, res) => {
    const data = await signaturesService.getByShareSlug(req.params.slug);
    const vcard = await signaturesService.buildVcard(data);
    const filename = `${[data.firstName, data.lastName].filter(Boolean).join('-') || 'contact'}.vcf`;
    res.setHeader('Content-Type', 'text/vcard; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-store');
    res.send(vcard);
  }),
);

router.get(
  '/signatures',
  authenticate,
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    res.json({ success: true, data: await signaturesService.listSignatures(req.user!.id, isAdmin) });
  }),
);

router.post(
  '/signatures/upload',
  authenticate,
  requireWrite,
  express.raw({ type: () => true, limit: '10mb' }),
  asyncHandler(async (req, res) => {
    const buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || []);
    const saved = await signatureMedia.saveSignatureImage({
      buffer,
      contentType: req.headers['content-type'],
      filename: typeof req.headers['x-filename'] === 'string' ? req.headers['x-filename'] : null,
    });
    res.status(201).json({ success: true, data: saved });
  }),
);

router.post(
  '/signatures/preview',
  authenticate,
  asyncHandler(async (req, res) => {
    const body = signatureSchema.parse(req.body);
    const origin = requestOrigin(req);
    const sharePath =
      typeof req.body?.shareSlug === 'string' && req.body.shareSlug
        ? `/s/${req.body.shareSlug}`
        : '/s/preview';
    const preview = signaturesService.previewFromInput(body, sharePath);
    const cardUrl = `${origin}${preview.sharePath}`;
    res.json({
      success: true,
      data: {
        html: await signaturesService.buildSignatureImageHtml(preview, { cardUrl }),
        shareUrl: cardUrl,
      },
    });
  }),
);

router.post(
  '/signatures',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = signatureSchema.parse(req.body);
    const saved = await signaturesService.createSignature(req.user!.id, body);
    const origin = requestOrigin(req);
    const cardUrl = `${origin}${saved.sharePath}`;
    res.status(201).json({
      success: true,
      data: {
        ...saved,
        shareUrl: cardUrl,
        html: await signaturesService.buildSignatureImageHtml(saved, { cardUrl }),
      },
    });
  }),
);

router.put(
  '/signatures/:id',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const body = signatureSchema.parse(req.body);
    const isAdmin = req.user!.role === UserRole.ADMIN;
    const saved = await signaturesService.updateSignature(req.params.id, req.user!.id, isAdmin, body);
    const origin = requestOrigin(req);
    const cardUrl = `${origin}${saved.sharePath}`;
    res.json({
      success: true,
      data: {
        ...saved,
        shareUrl: cardUrl,
        html: await signaturesService.buildSignatureImageHtml(saved, { cardUrl }),
      },
    });
  }),
);

router.delete(
  '/signatures/:id',
  authenticate,
  requireWrite,
  asyncHandler(async (req, res) => {
    const isAdmin = req.user!.role === UserRole.ADMIN;
    res.json({
      success: true,
      data: await signaturesService.deleteSignature(req.params.id, req.user!.id, isAdmin),
    });
  }),
);

function requestOrigin(req: { headers: { origin?: string } }) {
  if (req.headers.origin) return req.headers.origin.replace(/\/$/, '');
  return config.corsOrigin.replace(/\/$/, '');
}

export default router;
