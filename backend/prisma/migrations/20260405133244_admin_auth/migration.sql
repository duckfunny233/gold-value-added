-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "displayName" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminPermission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUserRole" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminRolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminRolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminOperationLog" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT,
    "module" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "traceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminOperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRole_code_key" ON "AdminRole"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AdminPermission_code_key" ON "AdminPermission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUserRole_adminUserId_roleId_key" ON "AdminUserRole"("adminUserId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminRolePermission_roleId_permissionId_key" ON "AdminRolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "AdminOperationLog_module_createdAt_idx" ON "AdminOperationLog"("module", "createdAt");

-- CreateIndex
CREATE INDEX "AdminOperationLog_traceId_idx" ON "AdminOperationLog"("traceId");

-- AddForeignKey
ALTER TABLE "AdminUserRole" ADD CONSTRAINT "AdminUserRole_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminUserRole" ADD CONSTRAINT "AdminUserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "AdminRole"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminRolePermission" ADD CONSTRAINT "AdminRolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "AdminPermission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminOperationLog" ADD CONSTRAINT "AdminOperationLog_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
