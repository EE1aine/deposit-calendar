export type CalcMode = 'rate' | 'fixed'
export type InterestMode = 'maturity' | 'monthly' | 'yearly'
export type DepositStatus = 'active' | 'withdrawn'

export interface Deposit {
  id: string
  name: string
  bank: string
  principalFen: number
  startDate: string // YYYY-MM-DD
  maturityDate: string // YYYY-MM-DD
  calcMode: CalcMode
  annualRate?: number // %, calcMode=rate 时必填
  interestFen?: number // calcMode=fixed 时必填
  interestMode: InterestMode
  autoRenew: boolean
  status: DepositStatus
  note?: string
  createdAt: string
}

export interface Settings {
  yearBase: 360 | 365
}

export type CashflowType = 'interest' | 'principal'

export interface CashflowEvent {
  depositId: string
  depositName: string
  bank: string
  date: string // YYYY-MM-DD
  type: CashflowType
  amountFen: number
  label: string // 到期利息 / 第 N 期派息 / 收回本金 / 转存续期
  renewed?: boolean // 自动转存产生的到期事件
}

export interface DayCashflow {
  date: string
  interestFen: number
  principalFen: number
  events: CashflowEvent[]
}
