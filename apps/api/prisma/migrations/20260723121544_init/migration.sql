-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SOLUTION_ARCHITECT', 'SALES', 'DELIVERY_MANAGER', 'FINANCE', 'READ_ONLY');

-- CreateEnum
CREATE TYPE "EstimateStatus" AS ENUM ('DRAFT', 'PRE_SALES_REVIEW', 'MANAGEMENT_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "Complexity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'ENTERPRISE');

-- CreateEnum
CREATE TYPE "ResourceLocation" AS ENUM ('ONSHORE', 'OFFSHORE');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('HOSTING', 'INFRASTRUCTURE', 'AWS', 'AZURE', 'GCP', 'THIRD_PARTY_API', 'LICENSE', 'SUBCONTRACTOR', 'TRAVEL', 'MEETING', 'EQUIPMENT', 'MARKETING', 'LEGAL', 'COMPLIANCE', 'SECURITY', 'DEV_SERVER', 'MISCELLANEOUS', 'OTHER');

-- CreateEnum
CREATE TYPE "MarginHealth" AS ENUM ('GREEN', 'YELLOW', 'RED');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('SUBMIT', 'APPROVE', 'REJECT', 'REQUEST_CHANGES', 'ARCHIVE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'SALES',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "countries" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "countries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employee_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "hourlyCostRate" DECIMAL(12,2) NOT NULL,
    "hourlyBillingRate" DECIMAL(12,2) NOT NULL,
    "currencyId" TEXT,
    "defaultLocation" "ResourceLocation" NOT NULL DEFAULT 'OFFSHORE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employee_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "dataType" TEXT NOT NULL DEFAULT 'number',
    "category" TEXT NOT NULL DEFAULT 'general',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_terms" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "minAmount" DECIMAL(14,2) NOT NULL,
    "maxAmount" DECIMAL(14,2),
    "warrantyDays" INTEGER NOT NULL,
    "terms" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "commissionRate" DECIMAL(8,4) NOT NULL,
    "cogsRate" DECIMAL(8,4) NOT NULL,
    "defaultSubcontractor" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "defaultDevServerCost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "defaultMargin" DECIMAL(8,4),
    "defaultRiskPct" DECIMAL(8,4),
    "defaultContingencyPct" DECIMAL(8,4),
    "defaultQaPct" DECIMAL(8,4),
    "defaultPmPct" DECIMAL(8,4),
    "defaultInfrastructurePct" DECIMAL(8,4),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_roles" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "location" "ResourceLocation" NOT NULL DEFAULT 'OFFSHORE',
    "defaultHours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "billRateOverride" DECIMAL(12,2),
    "costRateOverride" DECIMAL(12,2),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "template_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "countryId" TEXT,
    "currencyId" TEXT,
    "salesPersonId" TEXT,
    "accountManagerId" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimates" (
    "id" TEXT NOT NULL,
    "estimateNumber" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "description" TEXT,
    "clientId" TEXT,
    "templateId" TEXT,
    "complexity" "Complexity" NOT NULL DEFAULT 'MEDIUM',
    "status" "EstimateStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3),
    "expectedDelivery" TIMESTAMP(3),
    "currencyId" TEXT,
    "negotiatedPrice" DECIMAL(14,2),
    "recommendedPrice" DECIMAL(14,2),
    "discountPct" DECIMAL(8,4),
    "currentVersion" INTEGER NOT NULL DEFAULT 1,
    "createdById" TEXT NOT NULL,
    "wonAt" TIMESTAMP(3),
    "lostAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_resources" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "roleId" TEXT,
    "roleName" TEXT NOT NULL,
    "location" "ResourceLocation" NOT NULL DEFAULT 'OFFSHORE',
    "hours" DECIMAL(12,2) NOT NULL,
    "hourlyCost" DECIMAL(12,2) NOT NULL,
    "hourlyBilling" DECIMAL(12,2) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "totalRevenue" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_expenses" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'OTHER',
    "name" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_calculations" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "totalHours" DECIMAL(14,2) NOT NULL,
    "labourCost" DECIMAL(14,2) NOT NULL,
    "labourRevenue" DECIMAL(14,2) NOT NULL,
    "salesCommission" DECIMAL(14,2) NOT NULL,
    "cogs" DECIMAL(14,2) NOT NULL,
    "expenseTotal" DECIMAL(14,2) NOT NULL,
    "directCosts" DECIMAL(14,2) NOT NULL,
    "developmentCost" DECIMAL(14,2) NOT NULL,
    "operatingCost" DECIMAL(14,2) NOT NULL,
    "engagementFee" DECIMAL(14,2) NOT NULL,
    "recommendedPrice" DECIMAL(14,2) NOT NULL,
    "clientPrice" DECIMAL(14,2) NOT NULL,
    "grossProfit" DECIMAL(14,2) NOT NULL,
    "netProfit" DECIMAL(14,2) NOT NULL,
    "directMargin" DECIMAL(14,2) NOT NULL,
    "grossMarginPct" DECIMAL(8,4) NOT NULL,
    "netMarginPct" DECIMAL(8,4) NOT NULL,
    "targetMarginAmount" DECIMAL(14,2) NOT NULL,
    "targetMarginPct" DECIMAL(8,4) NOT NULL,
    "excessDeficit" DECIMAL(14,2) NOT NULL,
    "markupPct" DECIMAL(8,4) NOT NULL,
    "discountPct" DECIMAL(8,4) NOT NULL,
    "breakEven" DECIMAL(14,2) NOT NULL,
    "weightedHourlyCost" DECIMAL(12,4) NOT NULL,
    "weightedHourlyBilling" DECIMAL(12,4) NOT NULL,
    "averageTeamCost" DECIMAL(12,4) NOT NULL,
    "averageTeamBilling" DECIMAL(12,4) NOT NULL,
    "apiRate" DECIMAL(12,4) NOT NULL,
    "marketRate" DECIMAL(12,4) NOT NULL,
    "riskBuffer" DECIMAL(14,2) NOT NULL,
    "contingencyBuffer" DECIMAL(14,2) NOT NULL,
    "infrastructureCost" DECIMAL(14,2) NOT NULL,
    "supportCost" DECIMAL(14,2) NOT NULL,
    "warrantyCost" DECIMAL(14,2) NOT NULL,
    "maintenanceCost" DECIMAL(14,2) NOT NULL,
    "recurringCost" DECIMAL(14,2) NOT NULL,
    "monthlyCost" DECIMAL(14,2) NOT NULL,
    "annualCost" DECIMAL(14,2) NOT NULL,
    "roi" DECIMAL(10,4) NOT NULL,
    "marginHealth" "MarginHealth" NOT NULL DEFAULT 'YELLOW',
    "paymentTermLabel" TEXT,
    "paymentTerms" TEXT,
    "warrantyDays" INTEGER,
    "recommendations" JSONB,
    "cashFlowProjection" JSONB,
    "rawBreakdown" JSONB,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_scenarios" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "negotiatedPrice" DECIMAL(14,2),
    "timelineDays" INTEGER,
    "resourceSnapshot" JSONB,
    "expenseSnapshot" JSONB,
    "resultSnapshot" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "estimate_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "estimate_versions" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeSummary" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "estimate_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "fromStatus" "EstimateStatus",
    "toStatus" "EstimateStatus",
    "comment" TEXT,
    "actorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_suggestions" (
    "id" TEXT NOT NULL,
    "estimateId" TEXT,
    "type" TEXT NOT NULL,
    "input" JSONB,
    "output" JSONB,
    "confidence" DECIMAL(5,4),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "currencies_code_key" ON "currencies"("code");

-- CreateIndex
CREATE UNIQUE INDEX "countries_code_key" ON "countries"("code");

-- CreateIndex
CREATE UNIQUE INDEX "employee_roles_name_key" ON "employee_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "employee_roles_slug_key" ON "employee_roles"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "global_settings_key_key" ON "global_settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "service_templates_slug_key" ON "service_templates"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "template_roles_templateId_roleId_location_key" ON "template_roles"("templateId", "roleId", "location");

-- CreateIndex
CREATE UNIQUE INDEX "estimates_estimateNumber_key" ON "estimates"("estimateNumber");

-- CreateIndex
CREATE INDEX "estimates_status_idx" ON "estimates"("status");

-- CreateIndex
CREATE INDEX "estimates_clientId_idx" ON "estimates"("clientId");

-- CreateIndex
CREATE INDEX "estimates_createdById_idx" ON "estimates"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_calculations_estimateId_key" ON "estimate_calculations"("estimateId");

-- CreateIndex
CREATE UNIQUE INDEX "estimate_versions_estimateId_version_key" ON "estimate_versions"("estimateId", "version");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "ai_suggestions_estimateId_idx" ON "ai_suggestions"("estimateId");

-- AddForeignKey
ALTER TABLE "employee_roles" ADD CONSTRAINT "employee_roles_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_roles" ADD CONSTRAINT "template_roles_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "service_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_roles" ADD CONSTRAINT "template_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "employee_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "countries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_salesPersonId_fkey" FOREIGN KEY ("salesPersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_accountManagerId_fkey" FOREIGN KEY ("accountManagerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "service_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "currencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimates" ADD CONSTRAINT "estimates_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_resources" ADD CONSTRAINT "estimate_resources_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_resources" ADD CONSTRAINT "estimate_resources_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "employee_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_expenses" ADD CONSTRAINT "estimate_expenses_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_calculations" ADD CONSTRAINT "estimate_calculations_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_scenarios" ADD CONSTRAINT "estimate_scenarios_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_versions" ADD CONSTRAINT "estimate_versions_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estimate_versions" ADD CONSTRAINT "estimate_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "estimates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
