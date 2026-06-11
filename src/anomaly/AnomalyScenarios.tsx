import { FlaskConical, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { ANOMALY_SCENARIOS, scenarioById } from './scenarios'
import { useScenarios } from './scenario-store'

export function AnomalyScenarios() {
  const active = useScenarios((s) => s.active)
  const injecting = useScenarios((s) => s.injecting)
  const enable = useScenarios((s) => s.enable)
  const disable = useScenarios((s) => s.disable)

  async function toggle(id: string, next: boolean) {
    if (next) {
      await enable(id)
      toast.success(`Injected “${scenarioById(id)?.label}”`, {
        description: 'Added rows + steering AI autocomplete toward it.',
      })
    } else {
      disable(id)
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <FlaskConical className="size-3.5" />
          Anomalies
          {active.length > 0 && (
            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
              {active.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96">
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-medium">Inject anomaly scenarios</div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Common things analysts hunt for. Each adds representative rows to the data and hints
              the AI autocomplete toward queries that surface it.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {ANOMALY_SCENARIOS.map((scenario) => {
              const isActive = active.includes(scenario.id)
              const isInjecting = injecting === scenario.id
              const disabled = isInjecting || (injecting !== null && !isActive)
              return (
                <div
                  key={scenario.id}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-pressed={isActive}
                  aria-disabled={disabled}
                  onClick={() => {
                    if (!disabled) void toggle(scenario.id, !isActive)
                  }}
                  onKeyDown={(e) => {
                    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault()
                      void toggle(scenario.id, !isActive)
                    }
                  }}
                  className={cn(
                    'flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40',
                    isActive ? 'border-primary/40 bg-primary/5' : 'hover:bg-accent/40',
                    disabled && 'cursor-not-allowed opacity-60',
                  )}
                >
                  <Checkbox checked={isActive} tabIndex={-1} className="pointer-events-none mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 text-sm font-medium">
                      {scenario.label}
                      {isInjecting && (
                        <Loader2 className="size-3 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{scenario.description}</p>
                  </div>
                </div>
              )
            })}
          </div>

          <p className="text-[11px] text-muted-foreground">
            Injected rows persist until you Reset. Active scenarios steer ghost-text and ⇧⌘I
            completions.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
