-- 一期联调默认管理员（仅本地/空库初始化；生产请改密或禁用该账号）
-- 账号 admin，初始密钥 123456（SHA-256）
INSERT INTO "AdminUser" ("id", "username", "passwordHash", "displayName", "status", "createdAt", "updatedAt")
VALUES (
  'admin_user_default',
  'admin',
  '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
  '系统管理员',
  'ACTIVE',
  NOW(),
  NOW()
)
ON CONFLICT ("username") DO NOTHING;

INSERT INTO "AdminUserRole" ("id", "adminUserId", "roleId", "createdAt")
SELECT
  'aur_admin_user_default',
  "AdminUser"."id",
  "AdminRole"."id",
  NOW()
FROM "AdminUser"
JOIN "AdminRole" ON "AdminRole"."code" = 'SUPER_ADMIN'
WHERE "AdminUser"."username" = 'admin'
ON CONFLICT ("adminUserId", "roleId") DO NOTHING;
