-- AlterTable
ALTER TABLE "estimate_resources" ADD COLUMN IF NOT EXISTS "resourceCount" INTEGER NOT NULL DEFAULT 1;
