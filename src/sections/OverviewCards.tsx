import { useMemo } from 'react'
import { addMonths, differenceInDays, parseISO } from 'date-fns'
import { fenToYuan, impliedAnnualRate, termInterestFen } from '@/lib/finance'
import type { Deposit, Settings } from '@/types/deposit'

interface Props {
  deposits: Deposit[]
  settings: Settings
}

export function OverviewCards({ deposits, settings }: Props) {
  const stats = useMemo(() => {
    const active = deposits.filter((d) => d.status === 'active')
    const principal = active.reduce((s, d) => s + d.principalFen, 0)

    // 未来 12 个月预计利息：每笔存款按其剩余期限比例折算
    const today = new Date()
    const horizon = addMonths(today, 12)
    let interest12m = 0
    let weightedRate = 0
    let rateBase = 0
    for (const d of active) {
      const total = termInterestFen(d, settings.yearBase)
      const totalDays = Math.max(1, differenceInDays(parseISO(d.maturityDate), parseISO(d.startDate)))
      const from = parseISO(d.startDate) > today ? parseISO(d.startDate) : today
      const end = parseISO(d.maturityDate) < horizon ? parseISO(d.maturityDate) : horizon
      const days = Math.max(0, differenceInDays(end, from))
      interest12m += Math.round((total * days) / totalDays)
      const rate = impliedAnnualRate(d, settings.yearBase)
      if (rate != null && rate > 0) {
        weightedRate += rate * d.principalFen
        rateBase += d.principalFen
      }
    }

    // 最近到期
    const upcoming = active
      .filter((d) => differenceInDays(parseISO(d.maturityDate), today) >= 0)
      .sort((a, b) => a.maturityDate.localeCompare(b.maturityDate))[0]

    return {
      count: active.length,
      principal,
      interest12m,
      avgRate: rateBase > 0 ? weightedRate / rateBase : null,
      upcoming,
    }
  }, [deposits, settings])

  const cards = [
    { label: '存续本金总额', value: `¥${fenToYuan(stats.principal)}`, sub: `${stats.count} 笔存续中` },
    { label: '未来 12 个月预计利息', value: `¥${fenToYuan(stats.interest12m)}`, sub: '按当前利率折算' },
    {
      label: '加权平均利率',
      value: stats.avgRate != null ? `${stats.avgRate.toFixed(2)}%` : '—',
      sub: '全部存款本金加权，固定利息按隐含利率折算',
    },
    {
      label: '最近一笔到期',
      value: stats.upcoming ? stats.upcoming.maturityDate.slice(5).replace('-', ' / ') : '—',
      sub: stats.upcoming
        ? `${stats.upcoming.name} · ${Math.max(0, differenceInDays(parseISO(stats.upcoming.maturityDate), new Date()))} 天后`
        : '暂无',
    },
  ]

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-[22px] bg-card border p-4 shadow-[0_1px_2px_rgba(10,10,12,0.04)]">
          <div className="mono-label text-[10px] text-muted-foreground">{c.label}</div>
          <div className="tnum text-lg sm:text-2xl font-semibold mt-2 tracking-tight">{c.value}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}
