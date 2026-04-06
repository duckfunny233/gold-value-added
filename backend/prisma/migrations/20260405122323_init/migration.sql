-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'FROZEN', 'DISABLED');

-- CreateEnum
CREATE TYPE "RealNameStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'COMPLETED', 'MUTED');

-- CreateEnum
CREATE TYPE "RechargeStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssetChangeType" AS ENUM ('RECHARGE', 'WITHDRAW_FREEZE', 'WITHDRAW_RELEASE', 'WITHDRAW_COMPLETE', 'TRADE_BUY', 'TRADE_SELL', 'MANUAL_ADJUST');

-- CreateEnum
CREATE TYPE "NoticeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nickname" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "realNameStatus" "RealNameStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tentativeAsset" DECIMAL(18,2) NOT NULL,
    "cashAsset" DECIMAL(18,2) NOT NULL,
    "appreciationIncome" DECIMAL(18,2) NOT NULL,
    "goldHoldingGrams" DECIMAL(18,4) NOT NULL,
    "withdrawFrozenAmount" DECIMAL(18,2) NOT NULL,
    "totalAsset" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RechargeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "RechargeStatus" NOT NULL DEFAULT 'PENDING',
    "traceId" TEXT NOT NULL,
    "channelReference" TEXT,
    "autoSettleAt" TIMESTAMP(3) NOT NULL,
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RechargeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WithdrawalOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING',
    "queueNo" INTEGER NOT NULL,
    "traceId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "payeeName" TEXT,
    "wechatReceiptUrl" TEXT,
    "alipayReceiptUrl" TEXT,
    "bankName" TEXT,
    "bankAccountNo" TEXT,
    "bankAccountHolder" TEXT,
    "reviewerId" TEXT,
    "isVoiceMuted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WithdrawalOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'OPEN',
    "assetCode" TEXT NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,
    "quantityGrams" DECIMAL(18,4) NOT NULL,
    "filledGrams" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "traceId" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeMatch" (
    "id" TEXT NOT NULL,
    "buyOrderId" TEXT NOT NULL,
    "sellOrderId" TEXT NOT NULL,
    "matchedPrice" DECIMAL(18,2) NOT NULL,
    "matchedGrams" DECIMAL(18,4) NOT NULL,
    "traceId" TEXT NOT NULL,
    "matchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TradeMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "assetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "changeType" "AssetChangeType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "traceId" TEXT NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "actorType" TEXT NOT NULL,
    "actorId" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HashRecord" (
    "id" TEXT NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "sha256" CHAR(64) NOT NULL,
    "syncStatus" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rechargeOrderId" TEXT,
    "withdrawalOrderId" TEXT,
    "tradeOrderId" TEXT,

    CONSTRAINT "HashRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notice" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" "NoticeStatus" NOT NULL DEFAULT 'DRAFT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "id" TEXT NOT NULL,
    "configKey" TEXT NOT NULL,
    "configValue" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_uid_key" ON "User"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_userId_key" ON "Asset"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RechargeOrder_traceId_key" ON "RechargeOrder"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "WithdrawalOrder_traceId_key" ON "WithdrawalOrder"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeOrder_traceId_key" ON "TradeOrder"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "TradeMatch_traceId_key" ON "TradeMatch"("traceId");

-- CreateIndex
CREATE INDEX "LedgerEntry_userId_createdAt_idx" ON "LedgerEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_traceId_idx" ON "LedgerEntry"("traceId");

-- CreateIndex
CREATE INDEX "AuditLog_module_createdAt_idx" ON "AuditLog"("module", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_traceId_idx" ON "AuditLog"("traceId");

-- CreateIndex
CREATE INDEX "HashRecord_referenceType_referenceId_idx" ON "HashRecord"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "HashRecord_traceId_idx" ON "HashRecord"("traceId");

-- CreateIndex
CREATE UNIQUE INDEX "SystemConfig_configKey_key" ON "SystemConfig"("configKey");

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RechargeOrder" ADD CONSTRAINT "RechargeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WithdrawalOrder" ADD CONSTRAINT "WithdrawalOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOrder" ADD CONSTRAINT "TradeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeMatch" ADD CONSTRAINT "TradeMatch_buyOrderId_fkey" FOREIGN KEY ("buyOrderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeMatch" ADD CONSTRAINT "TradeMatch_sellOrderId_fkey" FOREIGN KEY ("sellOrderId") REFERENCES "TradeOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashRecord" ADD CONSTRAINT "HashRecord_rechargeOrderId_fkey" FOREIGN KEY ("rechargeOrderId") REFERENCES "RechargeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashRecord" ADD CONSTRAINT "HashRecord_withdrawalOrderId_fkey" FOREIGN KEY ("withdrawalOrderId") REFERENCES "WithdrawalOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HashRecord" ADD CONSTRAINT "HashRecord_tradeOrderId_fkey" FOREIGN KEY ("tradeOrderId") REFERENCES "TradeOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
