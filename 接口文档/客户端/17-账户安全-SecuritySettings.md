# 账户安全-SecuritySettings

## 页面名称与路由
- 页面：账户安全（SecuritySettings）
- 路由：`/settings/security`

## 功能点列表（页面按钮/动作级）
- 查看安全状态、设备、登录日志
- 更新安全开关
- 移除登录设备
- 修改安全密钥

## 接口清单表
| 接口名称 | 请求方法 | 接口路径 | 功能描述 | 是否已实现 |
| --- | --- | --- | --- | --- |
| 获取安全设置（本地） | LOCAL | `SettingsService.getSecuritySettings` | 加载安全信息 | 本地 Mock |
| 更新安全设置（本地） | LOCAL | `SettingsService.updateSecuritySettings` | 更新开关等配置 | 本地 Mock |
| 移除设备（本地） | LOCAL | `SettingsService.removeDevice` | 移除设备记录 | 本地 Mock |
| 修改密钥（本地） | LOCAL | `SettingsService.changeSecretKey` | 本地校验后更新密钥 | 本地 Mock |

## 请求/响应关键字段
- 本地关键字段：`biometricEnabled`、`devices[]`、`loginLogs[]`、`passwordSet`

## 现状与目标差异（新增手续费/扣款顺序影响点）
- 与手续费规则无直接关系。
- 目标建议补真实接口：`/api/settings/security/*`，并把敏感动作接入审计日志。

## 错误码与前端提示建议
- `400`：提示“参数无效”
- `401`：提示“登录失效，请重新登录”
