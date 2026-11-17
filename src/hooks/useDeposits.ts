import { useCallback, useEffect, useState } from 'react'
import { addDays, addMonths, addYears, format, subMonths, subYears } from 'date-fns'
import type { Deposit, Settings } from '@/types/deposit'
import { yuanToFen } from '@/lib/finance'

const DEPOSITS_KEY = 'dcd.deposits.v1'
const SETTINGS_KEY = 'dcd.settings.v1'
const SEEDED_KEY = 'dcd.seeded.v1'

const DEFAULT_SETTINGS: Settings = { yearBase: 365 }

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')
const now = () => new Date().toISOString()

/** 首次启动的示例数据（相对今天生成，保证日历上有内容） */
export function sampleDeposits(): Deposit[] {
  const t = new Date()
  return [
    {
      id: crypto.randomUUID(),
      name: '招行 1 年期定期',
      bank: '招商银行',
      principalFen: yuanToFen(100000),
      startDate: fmt(subMonths(t, 11)),
      maturityDate: fmt(addMonths(subMonths(t, 11), 12)),
      calcMode: 'rate',
      annualRate: 1.95,
      interestMode: 'maturity',
      autoRenew: false,
      status: 'active',
      note: '示例数据，可删除',
      createdAt: now(),
    },
    {
      id: crypto.randomUUID(),
      name: '工行 3 月期定期',
      bank: '工商银行',
      principalFen: yuanToFen(50000),
      startDate: fmt(addDays(subMonths(t, 2), -20)),
      maturityDate: fmt(addDays(addMonths(subMonths(t, 2), 3), -20)),
      calcMode: 'rate',
      annualRate: 1.35,
      interestMode: 'maturity',
      autoRenew: true,
      status: 'active',
      note: '示例：自动转存',
      createdAt: now(),
    },
    {
      id: crypto.randomUUID(),
      name: '建行大额存单',
      bank: '建设银行',
      principalFen: yuanToFen(300000),
      startDate: fmt(subYears(t, 1)),
      maturityDate: fmt(addYears(subYears(t, 1), 2)),
      calcMode: 'fixed',
      interestFen: yuanToFen(16500),
      interestMode: 'yearly',
      autoRenew: false,
      status: 'active',
      note: '示例：直接填写利息，按年付息',
      createdAt: now(),
    },
  ]
}

export function useDeposits() {
  const [deposits, setDeposits] = useState<Deposit[]>(() => {
    const existing = load<Deposit[]>(DEPOSITS_KEY, [])
    if (existing.length === 0 && !localStorage.getItem(SEEDED_KEY)) {
      const seed = sampleDeposits()
      localStorage.setItem(SEEDED_KEY, '1')
      return seed
    }
    return existing
  })
  const [settings, setSettings] = useState<Settings>(() => load(SETTINGS_KEY, DEFAULT_SETTINGS))

  useEffect(() => {
    localStorage.setItem(DEPOSITS_KEY, JSON.stringify(deposits))
  }, [deposits])
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  const upsert = useCallback((d: Deposit) => {
    setDeposits((prev) => {
      const i = prev.findIndex((x) => x.id === d.id)
      if (i >= 0) {
        const next = [...prev]
        next[i] = d
        return next
      }
      return [...prev, d]
    })
  }, [])

  const remove = useCallback((id: string) => {
    setDeposits((prev) => prev.filter((d) => d.id !== id))
  }, [])

  const markWithdrawn = useCallback((id: string) => {
    setDeposits((prev) => prev.map((d) => (d.id === id ? { ...d, status: 'withdrawn' as const } : d)))
  }, [])

  const replaceAll = useCallback((list: Deposit[]) => setDeposits(list), [])
  const clearAll = useCallback(() => setDeposits([]), [])

  return { deposits, settings, setSettings, upsert, remove, markWithdrawn, replaceAll, clearAll }
}

/* ---------- 导入导出 ---------- */

export function exportJSON(deposits: Deposit[], settings: Settings) {
  const blob = new Blob([JSON.stringify({ version: 1, settings, deposits }, null, 2)], {
    type: 'application/json',
  })
  downloadBlob(blob, `定期存款备份-${format(new Date(), 'yyyyMMdd')}.json`)
}

export function exportCSV(deposits: Deposit[]) {
  const head = '名称,银行,本金(元),存入日期,到期日期,计息方式,年利率(%),利息金额(元),付息方式,自动转存,状态,备注'
  const rows = deposits.map((d) =>
    [
      d.name,
      d.bank,
      (d.principalFen / 100).toFixed(2),
      d.startDate,
      d.maturityDate,
      d.calcMode === 'rate' ? '按利率计算' : '直接填写利息',
      d.calcMode === 'rate' ? d.annualRate ?? '' : '',
      d.calcMode === 'fixed' ? ((d.interestFen ?? 0) / 100).toFixed(2) : '',
      d.interestMode === 'maturity' ? '到期一次还本付息' : d.interestMode === 'monthly' ? '按月付息' : '按年付息',
      d.autoRenew ? '是' : '否',
      d.status === 'active' ? '存续中' : '已支取',
      (d.note ?? '').replaceAll(',', '，'),
    ].join(','),
  )
  const blob = new Blob(['﻿' + head + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
  downloadBlob(blob, `定期存款台账-${format(new Date(), 'yyyyMMdd')}.csv`)
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function parseImportJSON(text: string): { deposits: Deposit[]; settings?: Settings } {
  const data = JSON.parse(text)
  const list: Deposit[] = Array.isArray(data) ? data : data.deposits
  if (!Array.isArray(list)) throw new Error('文件格式不正确')
  for (const d of list) {
    if (!d.id || !d.principalFen || !d.startDate || !d.maturityDate) {
      throw new Error('存款记录缺少必要字段')
    }
  }
  return { deposits: list, settings: Array.isArray(data) ? undefined : data.settings }
}
