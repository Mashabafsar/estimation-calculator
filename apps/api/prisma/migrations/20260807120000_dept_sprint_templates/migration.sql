-- AlterTable
ALTER TABLE "service_templates" ADD COLUMN IF NOT EXISTS "defaultSprintCount" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "service_templates" ADD COLUMN IF NOT EXISTS "defaultSprintWeeks" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "service_templates" ADD COLUMN IF NOT EXISTS "sprintPaymentPlan" JSONB;

-- AlterTable
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "sprintCount" INTEGER;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "sprintWeeks" INTEGER;
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "sprintPaymentPlan" JSONB;

-- AlterTable
ALTER TABLE "estimate_calculations" ADD COLUMN IF NOT EXISTS "departmentTotals" JSONB;
ALTER TABLE "estimate_calculations" ADD COLUMN IF NOT EXISTS "sprintBreakdown" JSONB;
