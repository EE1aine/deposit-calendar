import { useMemo, useState } from 'react'
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear } from 'date-fns'
import { Plus, Settings as SettingsIcon, Landmark, CalendarDays, CalendarRange } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { MonthCalendar } from '@/sections/MonthCalendar'
import { YearCalendar, type MonthCashflow } from '@/sections/YearCalendar'
import { DayDetailSheet } from '@/sections/DayDetailSheet'
import { OverviewCards } from '@/sections/OverviewCards'
import { DepositFormDialog } from '@/sections/DepositFormDialog'
import { DepositList } from '@/sections/DepositList'
import { SettingsDialog } from '@/sections/SettingsDialog'
import { useDeposits } from '@/hooks/useDeposits'
import { eventsInRange, fenToYuan, groupByDay } from '@/lib/finance'
import type { Deposit, Settings } from '@/types/deposit'

export default function App() {
  const { deposits, settings, setSettings, upsert, remove, markWithdrawn, replaceAll, clearAll } =
    useDeposits()

  const [cursor, setCursor] = useState(() => new Date())
  const [view, setView] = useState<'month' | 'year'>('month')
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Deposit | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  // 当月（含前后溢出格）现金流事件
  const days = useMemo(() => {
    const from = startOfMonth(cursor)
    const to = endOfMonth(cursor)
    return groupByDay(eventsInRange(deposits, from, to, settings))
  }, [deposits, cursor, settings])

  // 全年现金流按月聚合（年视图）
  const yearData = useMemo(() => {
    const empty = { months: [] as MonthCashflow[], interest: 0, principal: 0, count: 0 }
    if (view !== 'year') return empty
    const events = eventsInRange(deposits, startOfYear(cursor), endOfYear(cursor), settings)
    const buckets = new Map<number, { interestFen: number; principalFen: number; ids: Set<string> }>()
    const allIds = new Set<string>()
    for (const e of events) {
      const m = parseInt(e.date.slice(5, 7))
      const b = buckets.get(m) ?? { interestFen: 0, principalFen: 0, ids: new Set<string>() }
      if (e.type === 'interest') b.interestFen += e.amountFen
      else b.principalFen += e.amountFen
      b.ids.add(e.depositId)
      allIds.add(e.depositId)
      buckets.set(m, b)
    }
    const months = Array.from({ length: 12 }, (_, i) => {
      const b = buckets.get(i + 1)
      return {
        month: i + 1,
        interestFen: b?.interestFen ?? 0,
        principalFen: b?.principalFen ?? 0,
        depositCount: b?.ids.size ?? 0,
      }
    })
    return {
      months,
      interest: months.reduce((s, m) => s + m.interestFen, 0),
      principal: months.reduce((s, m) => s + m.principalFen, 0),
      count: allIds.size,
    }
  }, [deposits, cursor, settings, view])
  const yearMonths = yearData.months

  const monthSummary = useMemo(() => {
    let interest = 0
    let principal = 0
    let count = 0
    const keys = new Set<string>()
    for (const d of days.values()) {
      interest += d.interestFen
      principal += d.principalFen
      for (const e of d.events) keys.add(e.depositId)
    }
    count = keys.size
    return { interest, principal, count }
  }, [days])

  const knownBanks = useMemo(
    () => Array.from(new Set(deposits.map((d) => d.bank))).filter(Boolean),
    [deposits],
  )

  const selectedCashflow = selectedDay ? days.get(selectedDay) ?? null : null

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const onReplaceAll = (list: Deposit[], s?: Settings) => {
    replaceAll(list)
    if (s) setSettings(s)
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Landmark className="size-5 text-primary shrink-0" aria-hidden />
            <h1 className="font-semibold tracking-tight truncate">定期存款日历</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" aria-label="设置与数据" onClick={() => setSettingsOpen(true)}>
              <SettingsIcon className="size-4" />
            </Button>
            <Button size="sm" onClick={openNew}>
              <Plus className="size-4 mr-1" /> 录入存款
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-5 space-y-5">
        <OverviewCards deposits={deposits} settings={settings} />

        <div className="grid lg:grid-cols-[1fr_360px] gap-5 items-start">
          <div className="space-y-3">
            <div className="flex items-center gap-1 bg-secondary/70 rounded-full p-1 w-fit">
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-full"
                onClick={() => setView('month')}
              >
                <CalendarDays className="size-4 mr-1.5" /> 月视图
              </Button>
              <Button
                variant={view === 'year' ? 'default' : 'ghost'}
                size="sm"
                className="rounded-full"
                onClick={() => setView('year')}
              >
                <CalendarRange className="size-4 mr-1.5" /> 年视图
              </Button>
            </div>

            {view === 'month' ? (
              <MonthCalendar
                cursor={cursor}
                onCursorChange={setCursor}
                days={days}
                selected={selectedDay}
                onSelect={(d) => setSelectedDay(d)}
              />
            ) : (
              <YearCalendar
                cursor={cursor}
                onCursorChange={setCursor}
                months={yearMonths}
                onPickMonth={(m) => {
                  setCursor(new Date(cursor.getFullYear(), m - 1, 1))
                  setView('month')
                }}
              />
            )}

            <div className="rounded-[22px] bg-card border px-5 py-4 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
              {view === 'month' ? (
                <>
                  <span className="mono-label text-[10px] text-muted-foreground w-full sm:w-auto">
                    {format(cursor, 'M 月')}汇总
                  </span>
                  <span>
                    <span className="text-muted-foreground">涉及存款 </span>
                    <span className="tnum font-medium">{monthSummary.count} 笔</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">利息合计 </span>
                    <span className="tnum font-semibold text-amber-800">¥{fenToYuan(monthSummary.interest)}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">到期本金 </span>
                    <span className="tnum font-medium">¥{fenToYuan(monthSummary.principal)}</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="mono-label text-[10px] text-muted-foreground w-full sm:w-auto">
                    {cursor.getFullYear()} 年汇总
                  </span>
                  <span>
                    <span className="text-muted-foreground">涉及存款 </span>
                    <span className="tnum font-medium">{yearData.count} 笔</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">利息合计 </span>
                    <span className="tnum font-semibold text-amber-800">¥{fenToYuan(yearData.interest)}</span>
                  </span>
                  <span>
                    <span className="text-muted-foreground">到期本金 </span>
                    <span className="tnum font-medium">¥{fenToYuan(yearData.principal)}</span>
                  </span>
                </>
              )}
            </div>
          </div>

          <DepositList
            deposits={deposits}
            settings={settings}
            onEdit={(d) => {
              setEditing(d)
              setFormOpen(true)
            }}
            onRemove={remove}
            onWithdraw={markWithdrawn}
          />
        </div>

        <footer className="text-xs text-muted-foreground pt-2 pb-6">
          数据仅保存在本浏览器 · 利息为测算值，实际以银行兑付为准
        </footer>
      </main>

      <DayDetailSheet
        day={
          selectedCashflow ??
          (selectedDay
            ? { date: selectedDay, interestFen: 0, principalFen: 0, events: [] }
            : null)
        }
        open={!!selectedDay}
        onOpenChange={(o) => !o && setSelectedDay(null)}
      />

      <DepositFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
        settings={settings}
        knownBanks={knownBanks}
        onSave={upsert}
      />

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        deposits={deposits}
        settings={settings}
        onSettingsChange={setSettings}
        onReplaceAll={onReplaceAll}
        onClearAll={clearAll}
      />

      <Toaster position="top-center" />
    </div>
  )
}
