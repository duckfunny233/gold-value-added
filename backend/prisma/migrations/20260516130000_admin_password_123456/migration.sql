-- 将默认管理员 admin 的密钥更新为 123456（SHA-256）
UPDATE "AdminUser"
SET
  "passwordHash" = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92',
  "updatedAt" = NOW()
WHERE "username" = 'admin';
