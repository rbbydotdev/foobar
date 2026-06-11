import { useMemo } from 'react'
import { FlaskConical, Loader2, ScanSearch, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useDb } from '@/db'
import { ANOMALY_SCENARIOS } from './scenarios'
import { getDataAnomalies } from './detect'
import { useAnomaly } from './store'

export function AnomalyPanel() {
  const dataVersion = useDb((s) => s.dataVersion)
  const status = useDb((s) => s.status)
  const steer = useAnomaly((s) => s.steerAutocomplete)
  const setSteer = useAnomaly((s) => s.setSteer)
  const injecting = useAnomaly((s) => s.injecting)
  const inject = useAnomaly((s) => s.inject)

  // Re-detect whenever the data changes (cached per dataVersion).
  const detected = useMemo(
    () => (status === 'ready' ? getDataAnomalies() : []),
    [status, dataVersion],
  )

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ScanSearch className="size-3.5" />
          Anomalies
          {detected.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {detected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[26rem]">
        <div className="flex flex-col gap-3.5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <Label htmlFor="anomaly-steer" className="text-sm font-medium">
                Steer autocomplete with detected anomalies
              </Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                The detector scans the live data (modified z-score + Benford’s Law) and hints the AI
                toward what looks anomalous.
              </p>
            </div>
            <Switch id="anomaly-steer" checked={steer} onCheckedChange={setSteer} />
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Detected in current data
            </div>
            {detected.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-3 text-center text-xs text-muted-foreground">
                No anomalies detected.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {detected.map((anomaly) => (
                  <div
                    key={anomaly.signature}
                    className="flex items-start gap-2 rounded-md border bg-card px-2.5 py-1.5"
                  >
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-amber-500" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium">{anomaly.title}</div>
                      <div className="text-[11px] text-muted-foreground">{anomaly.summary}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Inject a test anomaly
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ANOMALY_SCENARIOS.map((scenario) => (
                <Button
                  key={scenario.id}
                  variant="secondary"
                  size="xs"
                  className="gap-1"
                  disabled={injecting !== null || status !== 'ready'}
                  title={scenario.description}
                  onClick={() =>
                    void inject(scenario.id).then(() =>
                      toast.success(`Injected “${scenario.label}”`, {
                        description: 'The detector will surface it from the data.',
                      }),
                    )
                  }
                >
                  {injecting === scenario.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <FlaskConical className="size-3" />
                  )}
                  {scenario.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
