-- CreateEnum
CREATE TYPE "LeaderboardRule" AS ENUM ('GOLD_HOLDING_GRAMS', 'TOTAL_ASSET');

-- CreateEnum
CREATE TYPE "LeaderboardJobStatus" AS ENUM ('REBUILDING', 'SYNCED', 'FAILED');

-- CreateTable
CREATE TABLE "LeaderboardConfig" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "currentRule" "LeaderboardRule" NOT NULL DEFAULT 'GOLD_HOLDING_GRAMS',
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardJob" (
    "id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "rule" "LeaderboardRule" NOT NULL,
    "status" "LeaderboardJobStatus" NOT NULL DEFAULT 'REBUILDING',
    "traceId" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "failedRows" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaderboardJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaderboardSnapshot" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "uid" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "goldHoldingGrams" DECIMAL(18,4) NOT NULL,
    "totalAsset" DECIMAL(18,2) NOT NULL,
    "syncStatus" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaderboardSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardConfig_scope_key" ON "LeaderboardConfig"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardJob_version_key" ON "LeaderboardJob"("version");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardJob_traceId_key" ON "LeaderboardJob"("traceId");

-- CreateIndex
CREATE INDEX "LeaderboardJob_status_updatedAt_idx" ON "LeaderboardJob"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "LeaderboardJob_rule_createdAt_idx" ON "LeaderboardJob"("rule", "createdAt");

-- CreateIndex
CREATE INDEX "LeaderboardJob_updatedAt_idx" ON "LeaderboardJob"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_jobId_rank_key" ON "LeaderboardSnapshot"("jobId", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "LeaderboardSnapshot_jobId_uid_key" ON "LeaderboardSnapshot"("jobId", "uid");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_rank_idx" ON "LeaderboardSnapshot"("rank");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_uid_idx" ON "LeaderboardSnapshot"("uid");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_updatedAt_idx" ON "LeaderboardSnapshot"("updatedAt");

-- CreateIndex
CREATE INDEX "LeaderboardSnapshot_syncStatus_idx" ON "LeaderboardSnapshot"("syncStatus");

-- AddForeignKey
ALTER TABLE "LeaderboardSnapshot" ADD CONSTRAINT "LeaderboardSnapshot_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "LeaderboardJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
