export type AdminActor = {
  adminUserId: string
  username: string
}

export type RechargeRow = {
  orderId: string
  uid: string
  nickname: string
  channel: string
  amount: string
  status: string
  createdAt: string
  traceId: string
}

export type WithdrawRow = {
  orderId: string
  uid: string
  nickname: string
  channel: string
  amount: string
  status: 'pending_review' | 'transfer_processing' | 'completed' | 'rejected'
  alertStatus: 'ringing' | 'muted' | 'stopped'
  createdAt: string
  payout: string
  queueNo: number
  submittedAtIso: string
}

export type LedgerRow = {
  traceId: string
  type: string
  target: string
  amount: string
  operator: string
  updatedAt: string
}
