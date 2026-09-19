-- AlterTable JobApplication
ALTER TABLE "JobApplication" ADD COLUMN "legalHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobApplication" ADD COLUMN "legalHoldReason" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN "consentRecorded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JobApplication" ADD COLUMN "consentVersion" TEXT;
ALTER TABLE "JobApplication" ADD COLUMN "consentRecordedAt" TIMESTAMP(3);

-- CreateTable EmailSuppression
CREATE TABLE "EmailSuppression" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "reason" TEXT DEFAULT 'UNSUBSCRIBED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSuppression_pkey" PRIMARY KEY ("id")
);

-- CreateTable UnsubscribeToken
CREATE TABLE "UnsubscribeToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnsubscribeToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmailSuppression_email_key" ON "EmailSuppression"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UnsubscribeToken_tokenHash_key" ON "UnsubscribeToken"("tokenHash");

-- CreateIndex
CREATE INDEX "UnsubscribeToken_tokenHash_idx" ON "UnsubscribeToken"("tokenHash");
