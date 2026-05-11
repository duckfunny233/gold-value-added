-- CreateTable
CREATE TABLE "UserLoginSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientFingerprint" TEXT NOT NULL,
    "deviceName" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '未知',
    "ipLast" TEXT NOT NULL DEFAULT '',
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserLoginSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserLoginSession_userId_clientFingerprint_key" ON "UserLoginSession"("userId", "clientFingerprint");

-- CreateIndex
CREATE INDEX "UserLoginSession_userId_lastSeenAt_idx" ON "UserLoginSession"("userId", "lastSeenAt");

-- AddForeignKey
ALTER TABLE "UserLoginSession" ADD CONSTRAINT "UserLoginSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
