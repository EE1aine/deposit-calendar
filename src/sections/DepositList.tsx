import { useMemo, useState } from 'react'
import { differenceInDays, parseISO } from 'date-fns'
import { Pencil, Trash2, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { fenToYuan, impliedAnnualRate, termInterestFen } from '@/lib/finance'
import type { Deposit, Settings } from '@/types/deposit'

interface Props {
  deposits: Deposit[]
  settings: Settings
  onEdit: (d: Deposit) => void
  onRemove: (id: string) => void
  onWithdraw: (id: string) => void
}

export function DepositList({ deposits, settings, onEdit, onRemove, onWithdraw }: Props) {
  const [confirming, setConfirming] = useState<Deposit | null>(null)

  const sorted = useMemo(
    () =>
      [...deposits].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'active' ? -1 : 1
        return a.maturityDate.localeCompare(b.maturityDate)
      }),
    [deposits],
  )

  if (sorted.length === 0) {
    return (
      <section className="rounded-[22px] bg-card border p-6 text-center text-sm text-muted-foreground">
        还没有存款记录，点击右上角「录入存款」开始。
      </section>
    )
  }

  return (
    <section className="rounded-[22px] bg-card border p-4 sm:p-5 shadow-[0_1px_2px_rgba(10,10,12,0.04)]">
      <h2 className="text-lg font-semibold tracking-tight mb-3">存款列表</h2>
      <ul className="space-y-2.5">
        {sorted.map((d) => {
          const interest = termInterestFen(d, settings.yearBase)
          const rate = impliedAnnualRate(d, settings.yearBase)
          const daysLeft = differenceInDays(parseISO(d.maturityDate), new Date())
          const inactive = d.status === 'withdrawn'
          return (
            <li
              key={d.id}
              className={cn(
                'rounded-xl border bg-background/60 p-3.5 transition-opacity',
                inactive && 'opacity-50',
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm truncate">{d.name}</span>
                    {inactive ? (
                      <span className="text-[10px] mono-label text-muted-foreground border rounded px-1.5 py-0.5">
                        已支取
                      </span>
                    ) : d.autoRenew ? (
                      <span className="text-[10px] mono-label text-accent-foreground bg-accent rounded px-1.5 py-0.5">
                        自动转存
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {d.bank} · {d.startDate} 存 → {d.maturityDate} 到期
                    {!inactive && (daysLeft >= 0 ? ` · ${daysLeft} 天后` : ' · 已到期')}
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" aria-label="编辑" onClick={() => onEdit(d)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  {!inactive && (
                    <Button variant="ghost" size="icon" aria-label="标记支取" onClick={() => onWithdraw(d.id)}>
                      <Wallet className="size-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="删除"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirming(d)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-baseline gap-4 mt-2 text-sm">
                <span className="tnum font-semibold">¥{fenToYuan(d.principalFen)}</span>
                <span className="tnum text-amber-800 font-medium">息 ¥{fenToYuan(interest)}</span>
                {rate != null && (
                  <span className="tnum text-xs text-muted-foreground">
                    {rate.toFixed(2)}%{d.calcMode === 'fixed' ? '（隐含）' : ''}
                  </span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">
                  {d.interestMode === 'maturity' ? '到期付息' : d.interestMode === 'monthly' ? '按月付息' : '按年付息'}
                </span>
              </div>
            </li>
          )
        })}
      </ul>

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除这笔存款？</AlertDialogTitle>
            <AlertDialogDescription>
              「{confirming?.name}」将被永久删除，此操作不可撤销。如已到期取回，建议改用「标记支取」保留记录。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirming) onRemove(confirming.id)
                setConfirming(null)
              }}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
