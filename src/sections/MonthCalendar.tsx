import { useMemo } from 'react'
import {
  addDays,
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { fenToYuan } from '@/lib/finance'
import type { DayCashflow } from '@/types/deposit'

interface Props {
  cursor: Date
  onCursorChange: (d: Date) => void
  days: Map<string, DayCashflow>
  selected: string | null
  onSelect: (date: string) => void
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日']
const YEARS = Array.from({ length: 121 }, (_, i) => 1980 + i)
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

/** 金额 → 热力强度 0..1（对数刻度，避免极端值压扁其他格子） */
function heatOf(fen: number, max: number): number {
  if (fen <= 0 || max <= 0) return 0
  return Math.min(1, Math.log1p(fen) / Math.log1p(max))
}

export function MonthCalendar({ cursor, onCursorChange, days, selected, onSelect }: Props) {
  const today = new Date()
  const cells = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    return Array.from({ length: 42 }, (_, i) => addDays(start, i))
  }, [cursor])

  const maxInterest = useMemo(() => {
    let m = 0
    for (const d of days.values()) m = Math.max(m, d.interestFen)
    return m
  }, [days])

  const year = cursor.getFullYear()
  const month = cursor.getMonth() + 1

  return (
    <section className="rounded-[22px] bg-card border p-4 sm:p-6 shadow-[0_1px_2px_rgba(10,10,12,0.04)]">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Select
            value={String(year)}
            onValueChange={(v) => onCursorChange(new Date(parseInt(v), month - 1, 1))}
          >
            <SelectTrigger className="h-8 w-[5.5rem] font-semibold" aria-label="选择年份">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y} 年
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={String(month)}
            onValueChange={(v) => onCursorChange(new Date(year, parseInt(v) - 1, 1))}
          >
            <SelectTrigger className="h-8 w-[4.5rem] font-semibold" aria-label="选择月份">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m} 月
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="上个月"
            onClick={() => onCursorChange(subMonths(cursor, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCursorChange(new Date())}>
            今天
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="下个月"
            onClick={() => onCursorChange(addMonths(cursor, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="mono-label text-[10px] text-muted-foreground text-center py-1">
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day) => {
          const key = format(day, 'yyyy-MM-dd')
          const cf = days.get(key)
          const inMonth = isSameMonth(day, cursor)
          const heat = heatOf(cf?.interestFen ?? 0, maxInterest)
          const hasPrincipal = (cf?.principalFen ?? 0) > 0
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              style={
                heat > 0
                  ? { backgroundColor: `color-mix(in oklab, hsl(39 100% 42%) ${8 + heat * 62}%, transparent)` }
                  : undefined
              }
              className={cn(
                'relative flex flex-col items-start justify-between rounded-lg p-1 sm:p-1.5 min-h-14 sm:min-h-20 text-left transition-colors duration-150 cursor-pointer overflow-hidden',
                'hover:ring-1 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                !inMonth && 'opacity-35',
                isSameDay(day, today) && 'ring-1 ring-foreground/40',
                selected === key && 'ring-2 ring-primary',
              )}
            >
              <span
                className={cn(
                  'text-xs sm:text-sm leading-none tnum',
                  isSameDay(day, today) ? 'font-bold' : 'text-foreground/80',
                )}
              >
                {format(day, 'd')}
              </span>
              {(cf?.interestFen ?? 0) > 0 && (
                <span className="tnum text-[10px] sm:text-xs font-semibold text-amber-900 leading-tight break-all">
                  ¥{fenToYuan(cf!.interestFen)}
                </span>
              )}
              {hasPrincipal && (
                <span
                  title="当日有本金到期"
                  className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground/70"
                />
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: 'hsl(39 100% 42% / 0.55)' }} />
          颜色越深 = 当日利息越多
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-1.5 rounded-full bg-foreground/70" />
          有本金到期
        </span>
      </div>
    </section>
  )
}
