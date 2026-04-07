-- AlterEnum
ALTER TYPE "AssetChangeType" ADD VALUE IF NOT EXISTS 'PAYMENT_OUT';
ALTER TYPE "AssetChangeType" ADD VALUE IF NOT EXISTS 'PAYMENT_IN';

-- CreateEnum
CREATE TYPE "PaymentScene" AS ENUM ('USER', 'MERCHANT');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "PaymentProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "qrPayload" TEXT NOT NULL,
    "displayName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "payerId" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "scene" "PaymentScene" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'COMPLETED',
    "remark" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "HashRecord" ADD COLUMN "paymentOrderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PaymentProfile_userId_key" ON "PaymentProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_traceId_key" ON "PaymentOrder"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentOrder_idempotencyKey_key" ON "PaymentOrder"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentOrder_payerId_createdAt_idx" ON "PaymentOrder"("payerId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_payeeId_createdAt_idx" ON "PaymentOrder"("payeeId", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentOrder_status_createdAt_idx" ON "PaymentOrder"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentProfile" ADD CONSTRAINT "PaymentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentOrder" ADD CONSTRAINT "PaymentOrder_payeeId_fkey" FOREIGN KEY ("payeeId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashRecord" ADD CONSTRAINT "HashRecord_paymentOrderId_fkey" FOREIGN KEY ("paymentOrderId") REFERENCES "PaymentOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add constraints to prevent negative appreciation income
ALTER TABLE "Asset"
  ADD CONSTRAINT "Asset_appreciationIncome_non_negative" CHECK ("appreciationIncome" >= 0);
