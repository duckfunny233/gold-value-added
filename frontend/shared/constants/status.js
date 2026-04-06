export const WITHDRAW_STATUS = Object.freeze({
  PENDING_REVIEW: 'pending_review',
  TRANSFER_PROCESSING: 'transfer_processing',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
})

export const WITHDRAW_ALERT_STATUS = Object.freeze({
  RINGING: 'ringing',
  MUTED: 'muted',
  STOPPED: 'stopped',
})

export const WITHDRAW_STATUS_LABELS = Object.freeze({
  [WITHDRAW_STATUS.PENDING_REVIEW]: '待审核',
  [WITHDRAW_STATUS.TRANSFER_PROCESSING]: '转账处理中',
  [WITHDRAW_STATUS.COMPLETED]: '已完成',
  [WITHDRAW_STATUS.REJECTED]: '已拒绝',
})

export const WITHDRAW_ALERT_STATUS_LABELS = Object.freeze({
  [WITHDRAW_ALERT_STATUS.RINGING]: '提醒中',
  [WITHDRAW_ALERT_STATUS.MUTED]: '已静音',
  [WITHDRAW_ALERT_STATUS.STOPPED]: '已停止',
})

export function getWithdrawStatusLabel(status) {
  return WITHDRAW_STATUS_LABELS[status] || status || '-'
}

export function getWithdrawAlertStatusLabel(alertStatus) {
  return WITHDRAW_ALERT_STATUS_LABELS[alertStatus] || alertStatus || '-'
}
