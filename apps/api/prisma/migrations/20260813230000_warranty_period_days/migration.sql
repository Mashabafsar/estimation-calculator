-- Rename warranty months → warranty period days (default 0)
ALTER TABLE "estimates" ADD COLUMN IF NOT EXISTS "warrantyPeriodDays" INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estimates' AND column_name = 'warrantyMonths'
  ) THEN
    UPDATE "estimates"
    SET "warrantyPeriodDays" = COALESCE("warrantyMonths", 0) * 30
    WHERE "warrantyPeriodDays" = 0 AND COALESCE("warrantyMonths", 0) > 0;
    ALTER TABLE "estimates" DROP COLUMN "warrantyMonths";
  END IF;
END $$;
