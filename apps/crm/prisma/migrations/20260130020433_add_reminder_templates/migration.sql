-- AlterTable
ALTER TABLE "Customer" ADD COLUMN "birthDate" DATETIME;
ALTER TABLE "Customer" ADD COLUMN "paymentDueDay" INTEGER;

-- CreateTable
CREATE TABLE "ReminderTemplate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL DEFAULT 0,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ReminderTemplate_organizationId_idx" ON "ReminderTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "ReminderTemplate_triggerType_idx" ON "ReminderTemplate"("triggerType");
