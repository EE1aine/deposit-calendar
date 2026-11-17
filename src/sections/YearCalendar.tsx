import { useMemo } from 'react'
import { addYears, subYears } from 'date-fns'
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

export interface MonthCashflow {
  month: number // 1-12
  interestFen: number
  principalFen: number
  depositCount: number
}

interface Props {
  cursor: Date
  onCursorChange: (d: Date) => void
  months: MonthCashflow[]
  onPickMonth: (month: number) => void // 切到该月的月视图
}

const YEARS = Array.from({ length: 121 }, (_, i) => 1980 + i)

function heatOf(fen: number, max: number): number {
  if (fen <= 0 || max <= 0) return 0
  return Math.min(1, Math.log1p(fen) / Math.log1p(max))
}

export function YearCalendar({ cursor, onCursorChange, months, onPickMonth }: Props) {
  const year = cursor.getFullYear()
  const now = new Date()
  const maxInterest = useMemo(() => months.reduce((m, x) => Math.max(m, x.interestFen), 0), [months])

  return (
    <section className="rounded-[22px] bg-card border p-4 sm:p-6 shadow-[0_1px_2px_rgba(10,10,12,0.04)]">
      <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
        <Select
          value={String(year)}
          onValueChange={(v) => onCursorChange(new Date(parseInt(v), cursor.getMonth(), 1))}
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
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="上一年"
            onClick={() => onCursorChange(subYears(cursor, 1))}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => onCursorChange(new Date())}>
            今年
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="下一年"
            onClick={() => onCursorChange(addYears(cursor, 1))}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {months.map((m) => {
          const heat = heatOf(m.interestFen, maxInterest)
          const isCurrent = year === now.getFullYear() && m.month === now.getMonth() + 1
          return (
            <button
              key={m.month}
              type="button"
              onClick={() => onPickMonth(m.month)}
              style={
                heat > 0
                  ? { backgroundColor: `color-mix(in oklab, hsl(39 100% 42%) ${8 + heat * 62}%, transparent)` }
                  : undefined
              }
              className={cn(
                'rounded-xl border p-3 text-left transition-colors duration-150 cursor-pointer min-h-20 flex flex-col justify-between',
                'hover:ring-1 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isCurrent && 'ring-1 ring-foreground/40',
              )}
            >
              <div className="flex items-baseline justify-between">
                <span className={cn('text-sm tnum', isCurrent ? 'font-bold' : 'font-medium')}>
                  {m.month} 月
                </span>
                {m.depositCount > 0 && (
                  <span className="text-[10px] text-muted-foreground">{m.depositCount} 笔</span>
                )}
              </div>
              {m.interestFen > 0 ? (
                <div>
                  <div className="tnum text-sm sm:text-base font-semibold text-amber-900 leading-tight">
                    ¥{fenToYuan(m.interestFen)}
                  </div>
                  {m.principalFen > 0 && (
                    <div className="tnum text-[10px] text-muted-foreground mt-0.5">
                      本金到期 ¥{fenToYuan(m.principalFen)}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground/60">—</div>
              )}
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-sm" style={{ backgroundColor: 'hsl(39 100% 42% / 0.55)' }} />
          颜色越深 = 当月利息越多
        </span>
        <span>点击月份进入月视图</span>
      </div>
    </section>
  )
}
