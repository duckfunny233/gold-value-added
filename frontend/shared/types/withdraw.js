import { WITHDRAW_ALERT_STATUS, WITHDRAW_STATUS } from '../constants/status'

/**
 * @typedef {'pending_review' | 'transfer_processing' | 'completed' | 'rejected'} WithdrawStatus
 * @typedef {'ringing' | 'muted' | 'stopped'} WithdrawAlertStatus
 *
 * @typedef {Object} WithdrawOrder
 * @property {string} orderId
 * @property {string} uid
 * @property {string} nickname
 * @property {string} channel
 * @property {string} amount
 * @property {WithdrawStatus} status
 * @property {WithdrawAlertStatus} alertStatus
 * @property {string} createdAt
 * @property {string} payout
 * @property {string} [confirmCompletedAt]
 */

export const WITHDRAW_FIELD_KEYS = Object.freeze({
  STATUS: 'status',
  ALERT_STATUS: 'alertStatus',
  CONFIRM_COMPLETED_AT: 'confirmCompletedAt',
})

export const WITHDRAW_ENUM_SET = Object.freeze({
  status: Object.values(WITHDRAW_STATUS),
  alertStatus: Object.values(WITHDRAW_ALERT_STATUS),
})
