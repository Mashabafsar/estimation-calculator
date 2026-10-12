-- CreateTable
CREATE TABLE "email_signatures" (
    "id" TEXT NOT NULL,
    "shareSlug" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "directLine" TEXT,
    "cellPhone" TEXT,
    "email" TEXT,
    "facebook" TEXT,
    "instagram" TEXT,
    "linkedin" TEXT,
    "youtube" TEXT,
    "twitter" TEXT,
    "companyName" TEXT NOT NULL DEFAULT 'Agency Partner Interactive',
    "companyUrl" TEXT NOT NULL DEFAULT 'https://agencypartner.com',
    "companyStreet" TEXT NOT NULL DEFAULT '5830 Granite Pkwy STE 100 - 253',
    "companyCity" TEXT NOT NULL DEFAULT 'Plano',
    "companyRegion" TEXT NOT NULL DEFAULT 'TX',
    "companyPostal" TEXT NOT NULL DEFAULT '75024',
    "tagline" TEXT DEFAULT 'Be the catalyst to unlock growth and value for every business.',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_signatures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_signatures_shareSlug_key" ON "email_signatures"("shareSlug");

-- CreateIndex
CREATE INDEX "email_signatures_createdById_idx" ON "email_signatures"("createdById");

-- CreateIndex
CREATE INDEX "email_signatures_createdAt_idx" ON "email_signatures"("createdAt");

-- AddForeignKey
ALTER TABLE "email_signatures" ADD CONSTRAINT "email_signatures_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
