-- AlterTable
ALTER TABLE "Company" ADD COLUMN "slug" TEXT;
ALTER TABLE "Company" ADD COLUMN "domain" TEXT;
ALTER TABLE "Company" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Company" ADD COLUMN "plan" TEXT NOT NULL DEFAULT 'ENTERPRISE';
ALTER TABLE "Company" ADD COLUMN "brandColor" TEXT NOT NULL DEFAULT '#2563eb';
ALTER TABLE "Company" ADD COLUMN "settingsJson" TEXT;

-- Backfill slugs for existing records
UPDATE "Company" 
SET "slug" = CASE 
  WHEN "name" ILIKE '%Acme%' THEN 'acme-cloud'
  WHEN "name" ILIKE '%Alpha%' THEN 'alphacorp'
  WHEN "name" ILIKE '%Beta%' THEN 'betasystems'
  ELSE LOWER(REGEXP_REPLACE("name", '[^a-zA-Z0-9]+', '-', 'g')) || '-' || SUBSTRING("id" FROM 1 FOR 6)
END
WHERE "slug" IS NULL;

-- In case any fallback is needed
UPDATE "Company"
SET "slug" = 'company-' || SUBSTRING("id" FROM 1 FOR 8)
WHERE "slug" IS NULL OR "slug" = '';

-- AlterTable to set NOT NULL
ALTER TABLE "Company" ALTER COLUMN "slug" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Company_domain_key" ON "Company"("domain");

-- CreateIndex
CREATE INDEX "Company_slug_idx" ON "Company"("slug");
