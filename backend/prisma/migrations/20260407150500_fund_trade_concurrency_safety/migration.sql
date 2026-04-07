-- CreateEnum
CREATE TYPE "OperationIdempotencyStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "OperationIdempotency" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "requestHash" CHAR(64) NOT NULL,
    "responsePayload" JSONB,
    "status" "OperationIdempotencyStatus" NOT NULL DEFAULT 'PENDING',
    "traceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationIdempotency_pkey" PRIMARY KEY ("id")
);

-- CreateSequence
CREATE SEQUENCE IF NOT EXISTS "WithdrawalOrder_queueNo_seq";

-- Initialize sequence from current data
SELECT setval(
  '"WithdrawalOrder_queueNo_seq"',
  COALESCE((SELECT MAX("queueNo") FROM "WithdrawalOrder"), 0) + 1,
  false
);

-- AlterTable
ALTER TABLE "WithdrawalOrder"
  ALTER COLUMN "queueNo" SET DEFAULT nextval('"WithdrawalOrder_queueNo_seq"');

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalOrder_queueNo_key" ON "WithdrawalOrder"("queueNo");

-- CreateIndex
CREATE INDEX "WithdrawalOrder_status_submittedAt_idx" ON "WithdrawalOrder"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "Asset_updatedAt_idx" ON "Asset"("updatedAt");

-- CreateIndex
CREATE INDEX "TradeOrder_userId_submittedAt_idx" ON "TradeOrder"("userId", "submittedAt");

-- CreateIndex
CREATE INDEX "TradeOrder_status_submittedAt_idx" ON "TradeOrder"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_referenceType_referenceId_idx" ON "LedgerEntry"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "OperationIdempotency_key_key" ON "OperationIdempotency"("key");

-- CreateIndex
CREATE INDEX "OperationIdempotency_scope_status_updatedAt_idx" ON "OperationIdempotency"("scope", "status", "updatedAt");

-- CreateIndex
CREATE INDEX "OperationIdempotency_traceId_idx" ON "OperationIdempotency"("traceId");

-- Add constraints to prevent negative asset values
ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_tentativeAsset_non_negative" CHECK ("tentativeAsset" >= 0),
  ADD CONSTRAINT "Asset_cashAsset_non_negative" CHECK ("cashAsset" >= 0),
  ADD CONSTRAINT "Asset_withdrawFrozenAmount_non_negative" CHECK ("withdrawFrozenAmount" >= 0),
  ADD CONSTRAINT "Asset_goldHoldingGrams_non_negative" CHECK ("goldHoldingGrams" >= 0);
