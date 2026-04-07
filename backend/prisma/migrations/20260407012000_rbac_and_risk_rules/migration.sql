-- CreateTable
CREATE TABLE "RiskRuleConfig" (
    "id" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'default',
    "withdrawInterceptEnabled" BOOLEAN NOT NULL DEFAULT true,
    "singleWithdrawalLimit" DECIMAL(18,2) NOT NULL,
    "dailyWithdrawalLimit" DECIMAL(18,2) NOT NULL,
    "abnormalTradeThreshold" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskRuleConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RiskBlacklistUid" (
    "id" TEXT NOT NULL,
    "riskRuleConfigId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskBlacklistUid_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminUser_status_updatedAt_idx" ON "AdminUser"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "AdminUserRole_adminUserId_idx" ON "AdminUserRole"("adminUserId");

-- CreateIndex
CREATE INDEX "AdminUserRole_roleId_idx" ON "AdminUserRole"("roleId");

-- CreateIndex
CREATE INDEX "AdminRolePermission_roleId_idx" ON "AdminRolePermission"("roleId");

-- CreateIndex
CREATE INDEX "AdminRolePermission_permissionId_idx" ON "AdminRolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RiskRuleConfig_scope_key" ON "RiskRuleConfig"("scope");

-- CreateIndex
CREATE INDEX "RiskRuleConfig_updatedAt_idx" ON "RiskRuleConfig"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RiskBlacklistUid_riskRuleConfigId_uid_key" ON "RiskBlacklistUid"("riskRuleConfigId", "uid");

-- CreateIndex
CREATE INDEX "RiskBlacklistUid_uid_idx" ON "RiskBlacklistUid"("uid");

-- CreateIndex
CREATE INDEX "RiskBlacklistUid_updatedAt_idx" ON "RiskBlacklistUid"("updatedAt");

-- AddForeignKey
ALTER TABLE "RiskBlacklistUid" ADD CONSTRAINT "RiskBlacklistUid_riskRuleConfigId_fkey" FOREIGN KEY ("riskRuleConfigId") REFERENCES "RiskRuleConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed default permissions
INSERT INTO "AdminPermission" ("id", "code", "name", "description", "createdAt", "updatedAt") VALUES
('perm_security_read', 'security.read', '查看安全配置', '查看管理员、角色和权限列表', NOW(), NOW()),
('perm_security_assign_roles', 'security.admin-user.assign-roles', '分配管理员角色', '覆盖式分配管理员角色', NOW(), NOW()),
('perm_security_assign_permissions', 'security.role.assign-permissions', '分配角色权限', '覆盖式分配角色权限', NOW(), NOW()),
('perm_risk_rule_read', 'risk.rule.read', '查看风控规则', '查看风控规则配置', NOW(), NOW()),
('perm_risk_rule_update', 'risk.rule.update', '更新风控规则', '更新提现与交易风控规则', NOW(), NOW()),
('perm_risk_user_freeze', 'risk.user.freeze', '冻结用户', '执行冻结用户操作', NOW(), NOW()),
('perm_risk_user_unfreeze', 'risk.user.unfreeze', '解冻用户', '执行解冻用户操作', NOW(), NOW()),
('perm_trade_pause', 'trade.pause', '停盘', '暂停全站交易', NOW(), NOW()),
('perm_trade_resume', 'trade.resume', '恢复交易', '恢复全站交易', NOW(), NOW()),
('perm_fund_manual_transfer', 'fund.manual-transfer', '手工转账', '执行后台手工转账', NOW(), NOW()),
('perm_fund_manual_adjust', 'fund.manual-adjust', '手工补款', '执行后台手工补款/冲正', NOW(), NOW()),
('perm_leaderboard_rule_update', 'leaderboard.rule.update', '更新排行榜规则', '更新排行榜排序规则', NOW(), NOW()),
('perm_leaderboard_rebuild', 'leaderboard.rebuild', '重建排行榜', '执行排行榜重建', NOW(), NOW()),
('perm_leaderboard_retry_sync', 'leaderboard.retry-sync', '重试排行榜同步', '执行排行榜异常修复', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- Seed default super admin role
INSERT INTO "AdminRole" ("id", "code", "name", "description", "createdAt", "updatedAt")
VALUES ('role_super_admin', 'SUPER_ADMIN', '超级管理员', '默认拥有全部后台安全与治理权限', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- Bind all permissions to super admin role
INSERT INTO "AdminRolePermission" ("id", "roleId", "permissionId", "createdAt")
SELECT
  CONCAT('arp_', "AdminPermission"."id"),
  "AdminRole"."id",
  "AdminPermission"."id",
  NOW()
FROM "AdminRole"
JOIN "AdminPermission" ON 1 = 1
WHERE "AdminRole"."code" = 'SUPER_ADMIN'
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

-- Bootstrap super admin role for existing admins without any role
INSERT INTO "AdminUserRole" ("id", "adminUserId", "roleId", "createdAt")
SELECT
  CONCAT('aur_', "AdminUser"."id"),
  "AdminUser"."id",
  "AdminRole"."id",
  NOW()
FROM "AdminUser"
JOIN "AdminRole" ON "AdminRole"."code" = 'SUPER_ADMIN'
LEFT JOIN "AdminUserRole" ON "AdminUserRole"."adminUserId" = "AdminUser"."id"
WHERE "AdminUserRole"."id" IS NULL
ON CONFLICT ("adminUserId", "roleId") DO NOTHING;

-- Seed default risk rule config
INSERT INTO "RiskRuleConfig" (
  "id",
  "scope",
  "withdrawInterceptEnabled",
  "singleWithdrawalLimit",
  "dailyWithdrawalLimit",
  "abnormalTradeThreshold",
  "createdAt",
  "updatedAt"
) VALUES (
  'risk_rule_default',
  'default',
  true,
  50000.00,
  100000.00,
  200000.00,
  NOW(),
  NOW()
)
ON CONFLICT ("scope") DO NOTHING;
