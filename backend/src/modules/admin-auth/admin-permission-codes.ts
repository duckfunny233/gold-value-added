export const ADMIN_PERMISSION_CODES = {
  SECURITY_READ: 'security.read',
  SECURITY_ASSIGN_ROLES: 'security.admin-user.assign-roles',
  SECURITY_ASSIGN_PERMISSIONS: 'security.role.assign-permissions',
  RISK_RULE_READ: 'risk.rule.read',
  RISK_RULE_UPDATE: 'risk.rule.update',
  RISK_USER_FREEZE: 'risk.user.freeze',
  RISK_USER_UNFREEZE: 'risk.user.unfreeze',
  TRADE_PAUSE: 'trade.pause',
  TRADE_RESUME: 'trade.resume',
  FUND_MANUAL_TRANSFER: 'fund.manual-transfer',
  FUND_MANUAL_ADJUST: 'fund.manual-adjust',
  LEADERBOARD_RULE_UPDATE: 'leaderboard.rule.update',
  LEADERBOARD_REBUILD: 'leaderboard.rebuild',
  LEADERBOARD_RETRY_SYNC: 'leaderboard.retry-sync',
} as const

export const ADMIN_PERMISSION_DEFINITIONS = [
  {
    code: ADMIN_PERMISSION_CODES.SECURITY_READ,
    name: '查看安全配置',
    description: '查看管理员、角色和权限列表',
  },
  {
    code: ADMIN_PERMISSION_CODES.SECURITY_ASSIGN_ROLES,
    name: '分配管理员角色',
    description: '覆盖式分配管理员角色',
  },
  {
    code: ADMIN_PERMISSION_CODES.SECURITY_ASSIGN_PERMISSIONS,
    name: '分配角色权限',
    description: '覆盖式分配角色权限',
  },
  {
    code: ADMIN_PERMISSION_CODES.RISK_RULE_READ,
    name: '查看风控规则',
    description: '查看风控规则配置',
  },
  {
    code: ADMIN_PERMISSION_CODES.RISK_RULE_UPDATE,
    name: '更新风控规则',
    description: '更新提现与交易风控规则',
  },
  {
    code: ADMIN_PERMISSION_CODES.RISK_USER_FREEZE,
    name: '冻结用户',
    description: '执行冻结用户操作',
  },
  {
    code: ADMIN_PERMISSION_CODES.RISK_USER_UNFREEZE,
    name: '解冻用户',
    description: '执行解冻用户操作',
  },
  {
    code: ADMIN_PERMISSION_CODES.TRADE_PAUSE,
    name: '停盘',
    description: '暂停全站交易',
  },
  {
    code: ADMIN_PERMISSION_CODES.TRADE_RESUME,
    name: '恢复交易',
    description: '恢复全站交易',
  },
  {
    code: ADMIN_PERMISSION_CODES.FUND_MANUAL_TRANSFER,
    name: '手工转账',
    description: '执行后台手工转账',
  },
  {
    code: ADMIN_PERMISSION_CODES.FUND_MANUAL_ADJUST,
    name: '手工补款',
    description: '执行后台手工补款/冲正',
  },
  {
    code: ADMIN_PERMISSION_CODES.LEADERBOARD_RULE_UPDATE,
    name: '更新排行榜规则',
    description: '更新排行榜排序规则',
  },
  {
    code: ADMIN_PERMISSION_CODES.LEADERBOARD_REBUILD,
    name: '重建排行榜',
    description: '执行排行榜重建',
  },
  {
    code: ADMIN_PERMISSION_CODES.LEADERBOARD_RETRY_SYNC,
    name: '重试排行榜同步',
    description: '执行排行榜异常修复',
  },
] as const
