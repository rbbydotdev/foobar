import { useState } from 'react'
import { toast } from 'sonner'
import { Share2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useActiveProvider, useProviders } from '../store'
import type { AnomalyMode } from '../types'
import { buildShareLink } from '../share'
import { ProviderSelector } from './ProviderSelector'
import { ModelCombobox } from './ModelCombobox'
import { ProviderManagerDialog } from './ProviderManagerDialog'

const ANOMALY_LABELS: Record<AnomalyMode, string> = {
  off: 'Off',
  manual: 'Manual — button',
  auto: 'Auto — after each query',
}

export function AiSettings() {
  const enabled = useProviders((s) => s.autocompleteEnabled)
  const setEnabled = useProviders((s) => s.setAutocompleteEnabled)
  const debounceMs = useProviders((s) => s.debounceMs)
  const setDebounceMs = useProviders((s) => s.setDebounceMs)
  const anomalyMode = useProviders((s) => s.anomalyMode)
  const setAnomalyMode = useProviders((s) => s.setAnomalyMode)
  const setActiveModel = useProviders((s) => s.setActiveModel)
  const active = useActiveProvider()

  const [managerOpen, setManagerOpen] = useState(false)

  const ready = enabled && Boolean(active?.apiKey && active?.model)
  const statusLabel = !active
    ? 'AI: no provider'
    : !enabled
      ? 'AI: off'
      : active.model || 'AI: no model'

  async function shareActive() {
    if (!active) return
    try {
      await navigator.clipboard.writeText(buildShareLink(active))
      toast.success('Share link copied', {
        description: 'Includes the API key and model — share carefully.',
      })
    } catch {
      toast.error('Could not copy to clipboard')
    }
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5">
            <span
              className={cn(
                'size-1.5 rounded-full',
                ready ? 'bg-emerald-500' : 'bg-muted-foreground/40',
              )}
            />
            <Sparkles className="size-3.5" />
            <span className="max-w-[180px] truncate font-mono text-xs">{statusLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80">
          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Label htmlFor="ai-enabled" className="text-sm font-medium">
                  AI autocomplete
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Ghost-text SQL suggestions. Tab accepts, Esc dismisses.
                </p>
              </div>
              <Switch id="ai-enabled" checked={enabled} onCheckedChange={setEnabled} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Provider</Label>
              <ProviderSelector
                onAdd={() => setManagerOpen(true)}
                onManage={() => setManagerOpen(true)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">Model</Label>
              <ModelCombobox
                value={active?.model ?? ''}
                onChange={setActiveModel}
                disabled={!active}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="ai-debounce" className="text-sm font-medium">
                  Debounce
                </Label>
                <p className="mt-0.5 text-xs text-muted-foreground">Idle delay before asking.</p>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  id="ai-debounce"
                  type="number"
                  min={0}
                  step={50}
                  value={debounceMs}
                  onChange={(e) => {
                    const next = Number(e.currentTarget.value)
                    if (Number.isFinite(next)) setDebounceMs(Math.max(0, next))
                  }}
                  className="h-8 w-20"
                />
                <span className="text-xs text-muted-foreground">ms</span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Anomaly detection
                <span className="ml-1 font-normal text-muted-foreground/70">
                  (sends flagged rows to the model)
                </span>
              </Label>
              <Select value={anomalyMode} onValueChange={(v) => setAnomalyMode(v as AnomalyMode)}>
                <SelectTrigger size="sm" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ANOMALY_LABELS) as AnomalyMode[]).map((mode) => (
                    <SelectItem key={mode} value={mode}>
                      {ANOMALY_LABELS[mode]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!active}
              onClick={shareActive}
            >
              <Share2 className="size-3.5" />
              Copy share link
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <ProviderManagerDialog open={managerOpen} onOpenChange={setManagerOpen} />
    </>
  )
}
