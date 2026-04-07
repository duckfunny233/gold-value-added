-- CreateEnum
CREATE TYPE "ReportJobStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportArtifactFormat" AS ENUM ('CSV', 'EXCEL', 'JSON');

-- CreateTable
CREATE TABLE "ReportTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "defaultFormat" "ReportArtifactFormat" NOT NULL DEFAULT 'CSV',
    "createdByAdminUserId" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportJob" (
    "id" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "status" "ReportJobStatus" NOT NULL DEFAULT 'PENDING',
    "filters" JSONB NOT NULL,
    "requestedFormat" "ReportArtifactFormat" NOT NULL DEFAULT 'CSV',
    "traceId" TEXT NOT NULL,
    "templateId" TEXT,
    "createdByAdminUserId" TEXT,
    "errorMessage" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReportArtifact" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "format" "ReportArtifactFormat" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "traceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminOperationLog_traceId_createdAt_idx" ON "AdminOperationLog"("traceId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_traceId_createdAt_idx" ON "LedgerEntry"("traceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_traceId_createdAt_idx" ON "AuditLog"("traceId", "createdAt");

-- CreateIndex
CREATE INDEX "HashRecord_traceId_createdAt_idx" ON "HashRecord"("traceId", "createdAt");

-- CreateIndex
CREATE INDEX "ReportTemplate_reportType_createdAt_idx" ON "ReportTemplate"("reportType", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReportJob_traceId_key" ON "ReportJob"("traceId");

-- CreateIndex
CREATE INDEX "ReportJob_status_createdAt_idx" ON "ReportJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReportJob_reportType_createdAt_idx" ON "ReportJob"("reportType", "createdAt");

-- CreateIndex
CREATE INDEX "ReportArtifact_jobId_idx" ON "ReportArtifact"("jobId");

-- CreateIndex
CREATE INDEX "ReportArtifact_traceId_idx" ON "ReportArtifact"("traceId");

-- AddForeignKey
ALTER TABLE "ReportJob" ADD CONSTRAINT "ReportJob_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ReportTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReportArtifact" ADD CONSTRAINT "ReportArtifact_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "ReportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
