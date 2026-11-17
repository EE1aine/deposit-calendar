import { useEffect, useMemo, useState } from 'react'
import { addMonths, format, isAfter, parseISO } from 'date-fns'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fenToYuan, termInterestFen, yuanToFen } from '@/lib/finance'
import type { CalcMode, Deposit, InterestMode, Settings } from '@/types/deposit'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing: Deposit | null
  settings: Settings
  knownBanks: string[]
  onSave: (d: Deposit) => void
}

const TERMS = [
  { label: '3 个月', months: 3 },
  { label: '6 个月', months: 6 },
  { label: '1 年', months: 12 },
  { label: '2 年', months: 24 },
  { label: '3 年', months: 36 },
  { label: '5 年', months: 60 },
]

interface FormState {
  name: string
  bank: string
  principal: string
  startDate: string
  termMonths: string // 'custom' 或月数
  maturityDate: string
  calcMode: CalcMode
  annualRate: string
  interest: string
  interestMode: InterestMode
  autoRenew: boolean
  note: string
}

const emptyForm = (): FormState => ({
  name: '',
  bank: '',
  principal: '',
  startDate: format(new Date(), 'yyyy-MM-dd'),
  termMonths: '12',
  maturityDate: format(addMonths(new Date(), 12), 'yyyy-MM-dd'),
  calcMode: 'rate',
  annualRate: '',
  interest: '',
  interestMode: 'maturity',
  autoRenew: false,
  note: '',
})

export function DepositFormDialog({ open, onOpenChange, editing, settings, knownBanks, onSave }: Props) {
  const [f, setF] = useState<FormState>(emptyForm)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    if (editing) {
      setF({
        name: editing.name,
        bank: editing.bank,
        principal: (editing.principalFen / 100).toString(),
        startDate: editing.startDate,
        termMonths: 'custom',
        maturityDate: editing.maturityDate,
        calcMode: editing.calcMode,
        annualRate: editing.annualRate?.toString() ?? '',
        interest: editing.interestFen != null ? (editing.interestFen / 100).toString() : '',
        interestMode: editing.interestMode,
        autoRenew: editing.autoRenew,
        note: editing.note ?? '',
      })
    } else {
      setF(emptyForm())
    }
  }, [open, editing])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((p) => ({ ...p, [k]: v }))

  // 选存期自动算到期日
  const onTermChange = (v: string) => {
    set('termMonths', v)
    if (v !== 'custom') {
      try {
        set('maturityDate', format(addMonths(parseISO(f.startDate), parseInt(v)), 'yyyy-MM-dd'))
      } catch { /* 日期未填时忽略 */ }
    }
  }

  const preview = useMemo(() => {
    const principalFen = yuanToFen(f.principal)
    if (principalFen <= 0) return null
    try {
      if (!isAfter(parseISO(f.maturityDate), parseISO(f.startDate))) return null
    } catch {
      return null
    }
    const base = { calcMode: f.calcMode, principalFen, startDate: f.startDate, maturityDate: f.maturityDate }
    const interestFen =
      f.calcMode === 'fixed'
        ? yuanToFen(f.interest)
        : termInterestFen({ ...base, annualRate: parseFloat(f.annualRate) || 0 }, settings.yearBase)
    if (interestFen <= 0) return null
    return { interestFen, totalFen: principalFen + interestFen }
  }, [f, settings.yearBase])

  const rateWarning = f.calcMode === 'rate' && parseFloat(f.annualRate) > 10

  const submit = () => {
    const principalFen = yuanToFen(f.principal)
    if (!f.bank.trim()) return setError('请填写银行名称')
    if (principalFen <= 0) return setError('请填写有效的本金')
    if (!isAfter(parseISO(f.maturityDate), parseISO(f.startDate)))
      return setError('到期日必须晚于存入日')
    if (f.calcMode === 'rate' && !(parseFloat(f.annualRate) > 0)) return setError('请填写年利率')
    if (f.calcMode === 'fixed' && yuanToFen(f.interest) <= 0) return setError('请填写利息金额')
    if (rateWarning && !window.confirm(`年利率 ${f.annualRate}% 似乎偏高，确认无误？`)) return

    onSave({
      id: editing?.id ?? crypto.randomUUID(),
      name: f.name.trim() || `${f.bank.trim()}定期`,
      bank: f.bank.trim(),
      principalFen,
      startDate: f.startDate,
      maturityDate: f.maturityDate,
      calcMode: f.calcMode,
      annualRate: f.calcMode === 'rate' ? parseFloat(f.annualRate) : undefined,
      interestFen: f.calcMode === 'fixed' ? yuanToFen(f.interest) : undefined,
      interestMode: f.interestMode,
      autoRenew: f.autoRenew,
      status: editing?.status ?? 'active',
      note: f.note.trim() || undefined,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? '编辑存款' : '录入存款'}</DialogTitle>
          <DialogDescription className="sr-only">
            填写存款的本金、日期、利率或利息金额
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bank">银行 *</Label>
              <Input
                id="bank"
                list="known-banks"
                value={f.bank}
                onChange={(e) => set('bank', e.target.value)}
                placeholder="如：招商银行"
              />
              <datalist id="known-banks">
                {knownBanks.map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name">名称（选填）</Label>
              <Input
                id="name"
                value={f.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="默认用银行名"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="principal">本金（元）*</Label>
            <Input
              id="principal"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={f.principal}
              onChange={(e) => set('principal', e.target.value)}
              placeholder="100000"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">存入日期 *</Label>
              <Input
                id="startDate"
                type="date"
                value={f.startDate}
                onChange={(e) => set('startDate', e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>存期</Label>
              <Select value={f.termMonths} onValueChange={onTermChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TERMS.map((t) => (
                    <SelectItem key={t.months} value={String(t.months)}>
                      {t.label}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">自定义</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="maturityDate">到期日 *</Label>
            <Input
              id="maturityDate"
              type="date"
              value={f.maturityDate}
              onChange={(e) => {
                set('maturityDate', e.target.value)
                set('termMonths', 'custom')
              }}
            />
          </div>

          <div className="space-y-2">
            <Label>计息方式</Label>
            <RadioGroup
              value={f.calcMode}
              onValueChange={(v) => set('calcMode', v as CalcMode)}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="rate" /> 按年利率计算
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="fixed" /> 直接填写利息
              </label>
            </RadioGroup>
          </div>

          {f.calcMode === 'rate' ? (
            <div className="space-y-1.5">
              <Label htmlFor="rate">年利率（%）*</Label>
              <Input
                id="rate"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={f.annualRate}
                onChange={(e) => set('annualRate', e.target.value)}
                placeholder="如 1.95"
              />
              {rateWarning && <p className="text-xs text-destructive">利率超过 10%，请确认</p>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="interest">利息金额（元）*</Label>
              <Input
                id="interest"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={f.interest}
                onChange={(e) => set('interest', e.target.value)}
                placeholder="银行告知的到期利息"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>付息方式</Label>
            <Select value={f.interestMode} onValueChange={(v) => set('interestMode', v as InterestMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="maturity">到期一次还本付息</SelectItem>
                <SelectItem value="monthly">按月付息</SelectItem>
                <SelectItem value="yearly">按年付息</SelectItem>
              </SelectContent>
            </Select>
            {f.interestMode !== 'maturity' && (
              <p className="text-xs text-muted-foreground">
                利息将拆分为多期派息事件显示在日历上（末期补差）。
              </p>
            )}
          </div>

          <div className="flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5">
            <div>
              <div className="text-sm font-medium">到期自动转存</div>
              <div className="text-xs text-muted-foreground">本金滚动续存，日历持续生成未来事件</div>
            </div>
            <Switch checked={f.autoRenew} onCheckedChange={(v) => set('autoRenew', v)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">备注（选填）</Label>
            <Input id="note" value={f.note} onChange={(e) => set('note', e.target.value)} placeholder="存单编号等" />
          </div>

          {preview && (
            <div className="rounded-xl bg-accent px-4 py-3 flex items-center justify-between">
              <span className="mono-label text-[10px] text-accent-foreground/70">预计利息</span>
              <span className="tnum font-semibold">
                ¥{fenToYuan(preview.interestFen)}
                <span className="text-xs text-muted-foreground font-normal ml-2">
                  本息合计 ¥{fenToYuan(preview.totalFen)}
                </span>
              </span>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={submit}>{editing ? '保存修改' : '添加存款'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
