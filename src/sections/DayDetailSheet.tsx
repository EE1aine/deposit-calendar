import { format, parseISO } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Separator } from '@/components/ui/separator'
import { fenToYuan } from '@/lib/finance'
import type { DayCashflow } from '@/types/deposit'

interface Props {
  day: DayCashflow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DayDetailSheet({ day, open, onOpenChange }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>
            {day ? format(parseISO(day.date), 'yyyy 年 M 月 d 日 EEEE', { locale: zhCN }) : ''}
          </SheetTitle>
        </SheetHeader>
        {day && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-accent p-3">
                <div className="mono-label text-[10px] text-accent-foreground/70">当日利息</div>
                <div className="tnum text-xl font-semibold mt-1">¥{fenToYuan(day.interestFen)}</div>
              </div>
              <div className="rounded-xl bg-secondary p-3">
                <div className="mono-label text-[10px] text-muted-foreground">到期本金</div>
                <div className="tnum text-xl font-semibold mt-1">¥{fenToYuan(day.principalFen)}</div>
              </div>
            </div>
            <Separator />
            {day.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">当日没有现金流事件。</p>
            ) : (
              <ul className="space-y-3">
                {day.events.map((e, i) => (
                  <li key={i} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium">{e.depositName}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.bank} · {e.label}
                      </div>
                    </div>
                    <div className="tnum text-sm font-semibold whitespace-nowrap">
                      {e.type === 'interest' ? '+' : ''}¥{fenToYuan(e.amountFen)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-xs text-muted-foreground">
              提示：如遇节假日，部分银行到期日顺延至下一工作日。
            </p>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
