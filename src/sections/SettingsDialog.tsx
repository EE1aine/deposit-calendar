import { useRef, useState } from 'react'
import { Download, Upload, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { exportCSV, exportJSON, parseImportJSON, sampleDeposits } from '@/hooks/useDeposits'
import type { Deposit, Settings } from '@/types/deposit'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  deposits: Deposit[]
  settings: Settings
  onSettingsChange: (s: Settings) => void
  onReplaceAll: (list: Deposit[], settings?: Settings) => void
  onClearAll: () => void
}

export function SettingsDialog({
  open,
  onOpenChange,
  deposits,
  settings,
  onSettingsChange,
  onReplaceAll,
  onClearAll,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const onImportFile = async (file: File) => {
    try {
      const { deposits: list, settings: s } = parseImportJSON(await file.text())
      onReplaceAll(list, s)
      toast.success(`已导入 ${list.length} 笔存款`)
      onOpenChange(false)
    } catch (e) {
      toast.error(`导入失败：${e instanceof Error ? e.message : '文件无法解析'}`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>设置与数据</DialogTitle>
          <DialogDescription>
            数据仅保存在当前浏览器本地。清除浏览器数据会丢失记录，请定期导出备份。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 mt-2">
          <div className="space-y-2">
            <Label>计息年基数</Label>
            <RadioGroup
              value={String(settings.yearBase)}
              onValueChange={(v) => onSettingsChange({ yearBase: Number(v) as 360 | 365 })}
              className="flex gap-4"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="365" /> 365 天（默认）
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="360" /> 360 天
              </label>
            </RadioGroup>
            <p className="text-xs text-muted-foreground">
              计息规则：算头不算尾（存入日计息、到期日不计息）。直接填写利息的存款不受此设置影响。
            </p>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>数据备份</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => exportJSON(deposits, settings)}>
                <Download className="size-3.5 mr-1.5" /> 导出 JSON 备份
              </Button>
              <Button variant="outline" size="sm" onClick={() => exportCSV(deposits)}>
                <Download className="size-3.5 mr-1.5" /> 导出 CSV 台账
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="size-3.5 mr-1.5" /> 导入备份
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) onImportFile(file)
                  e.target.value = ''
                }}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>其他</Label>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onReplaceAll(sampleDeposits())}>
                恢复示例数据
              </Button>
              {confirmClear ? (
                <>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      onClearAll()
                      setConfirmClear(false)
                      toast.success('已清空全部数据')
                    }}
                  >
                    确认清空
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmClear(false)}>
                    取消
                  </Button>
                </>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmClear(true)}
                >
                  <Trash2 className="size-3.5 mr-1.5" /> 清空全部数据
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
