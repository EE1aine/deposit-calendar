import {
  addDays,
  addMonths,
  addYears,
  differenceInDays,
  differenceInMonths,
  differenceInYears,
  format,
  isAfter,
  isBefore,
  parseISO,
} from 'date-fns'
import type {
  CashflowEvent,
  DayCashflow,
  Deposit,
  Settings,
} from '@/types/deposit'

export const fmtDate = (d: Date | string): string =>
  typeof d === 'string' ? d : format(d, 'yyyy-MM-dd')

export const parseDay = (s: string): Date => parseISO(s)

/** 算头不算尾：存入日计息，到期日不计息 */
export function termDays(deposit: Deposit): number {
  return differenceInDays(parseDay(deposit.maturityDate), parseDay(deposit.startDate))
}

/** 整期利息（分）。rate 模式按公式计算；fixed 模式以填写值为准 */
export function termInterestFen(
  deposit: Pick<Deposit, 'calcMode' | 'annualRate' | 'interestFen' | 'principalFen'> & {
    startDate: string
    maturityDate: string
  },
  yearBase: 360 | 365,
): number {
  if (deposit.calcMode === 'fixed') return deposit.interestFen ?? 0
  const days = differenceInDays(parseDay(deposit.maturityDate), parseDay(deposit.startDate))
  const rate = (deposit.annualRate ?? 0) / 100
  return Math.round((deposit.principalFen * rate * days) / yearBase)
}

/** 反算隐含年利率（%），仅供展示 */
export function impliedAnnualRate(deposit: Deposit, yearBase: 360 | 365): number | null {
  if (deposit.calcMode === 'rate') return deposit.annualRate ?? null
  const days = termDays(deposit)
  if (days <= 0 || deposit.principalFen <= 0) return null
  return (((deposit.interestFen ?? 0) * yearBase) / (deposit.principalFen * days)) * 100
}

/** 同日月度日期，月末自动收敛（1/31 → 2/28） */
function sameDayClamped(base: Date, months: number): Date {
  return addMonths(base, months) // date-fns 已处理月末收敛
}

/** 把一个存期的总利息拆成派息计划（日期升序，最后一期补差） */
function payoutSchedule(
  start: Date,
  maturity: Date,
  totalFen: number,
  mode: Deposit['interestMode'],
): { date: string; amountFen: number; index: number; total: number }[] {
  if (mode === 'maturity' || totalFen === 0) {
    return [{ date: fmtDate(maturity), amountFen: totalFen, index: 1, total: 1 }]
  }
  const n = mode === 'monthly' ? differenceInMonths(maturity, start) : differenceInYears(maturity, start)
  if (n <= 0) return [{ date: fmtDate(maturity), amountFen: totalFen, index: 1, total: 1 }]
  const each = Math.floor(totalFen / n)
  const out = []
  let paid = 0
  for (let i = 1; i <= n; i++) {
    const d = mode === 'monthly' ? sameDayClamped(start, i) : addYears(start, i)
    const date = isAfter(d, maturity) ? maturity : d
    const amount = i === n ? totalFen - paid : each
    paid += amount
    out.push({ date: fmtDate(date), amountFen: amount, index: i, total: n })
  }
  return out
}

/**
 * 派生某笔存款在 [from, to] 区间内的全部现金流事件。
 * 自动转存：本金滚动续存（利息到期派发），逐期生成直到超出区间。
 */
export function eventsForDeposit(
  deposit: Deposit,
  from: Date,
  to: Date,
  settings: Settings,
): CashflowEvent[] {
  if (deposit.status === 'withdrawn') return []
  const events: CashflowEvent[] = []
  let cycleStart = parseDay(deposit.startDate)
  let cycleEnd = parseDay(deposit.maturityDate)
  let cycle = 0
  const span = differenceInDays(cycleEnd, cycleStart)
  if (span <= 0) return []
  // 自动转存时跳过已完整结束的历史周期（历史利息不重复记账到当前视图之前的区间仍可生成）
  while (isBefore(addDays(cycleEnd, -span), to) && cycle < 600) {
    const interest = termInterestFen(
      { ...deposit, startDate: fmtDate(cycleStart), maturityDate: fmtDate(cycleEnd) },
      settings.yearBase,
    )
    for (const p of payoutSchedule(cycleStart, cycleEnd, interest, deposit.interestMode)) {
      const label =
        deposit.interestMode === 'maturity'
          ? deposit.autoRenew && cycle >= 0
            ? '到期利息（转存）'
            : '到期利息'
          : `第 ${p.index}/${p.total} 期派息`
      const dt = parseDay(p.date)
      if (!isBefore(dt, from) && !isAfter(dt, to)) {
        events.push({
          depositId: deposit.id,
          depositName: deposit.name,
          bank: deposit.bank,
          date: p.date,
          type: 'interest',
          amountFen: p.amountFen,
          label,
          renewed: deposit.autoRenew,
        })
      }
    }
    // 本金到期事件：仅非自动转存时存在
    if (!deposit.autoRenew && !isBefore(cycleEnd, from) && !isAfter(cycleEnd, to)) {
      events.push({
        depositId: deposit.id,
        depositName: deposit.name,
        bank: deposit.bank,
        date: fmtDate(cycleEnd),
        type: 'principal',
        amountFen: deposit.principalFen,
        label: '收回本金',
      })
    }
    if (!deposit.autoRenew) break
    cycleStart = cycleEnd
    cycleEnd = addDays(cycleStart, span)
    cycle++
  }
  return events
}

export function eventsInRange(
  deposits: Deposit[],
  from: Date,
  to: Date,
  settings: Settings,
): CashflowEvent[] {
  return deposits.flatMap((d) => eventsForDeposit(d, from, to, settings))
}

export function groupByDay(events: CashflowEvent[]): Map<string, DayCashflow> {
  const map = new Map<string, DayCashflow>()
  for (const e of events) {
    const cur = map.get(e.date) ?? { date: e.date, interestFen: 0, principalFen: 0, events: [] }
    if (e.type === 'interest') cur.interestFen += e.amountFen
    else cur.principalFen += e.amountFen
    cur.events.push(e)
    map.set(e.date, cur)
  }
  return map
}

/* ---------- 金额格式化 ---------- */

export function fenToYuan(fen: number): string {
  return (fen / 100).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** 日历格子内的紧凑格式：≥1万 显示 x.x万 */
export function fenToCompact(fen: number): string {
  const yuan = fen / 100
  if (Math.abs(yuan) >= 10000) return `${(yuan / 10000).toFixed(yuan >= 100000 ? 0 : 1)}万`
  return yuan.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
}

export function yuanToFen(yuan: string | number): number {
  const n = typeof yuan === 'number' ? yuan : parseFloat(yuan)
  if (Number.isNaN(n)) return 0
  return Math.round(n * 100)
}
