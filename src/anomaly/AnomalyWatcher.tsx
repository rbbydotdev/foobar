import { useCallback, useEffect, useRef, useState } from 'react'
import { Loader2, Sparkles, TriangleAlert } from 'lucide-react'
import { useDb } from '@/db'
import { useActiveProvider } from '@/providers/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { detectAnomalies } from './detect'
import type { DataAnomaly } from './detect'
import { analyzeAnomaly } from './analyze'

interface AnalysisState {
  status: 'loading' | 'done' | 'error'
  text?: string
  error?: string
}

export function AnomalyWatcher() {
  const active = useActiveProvider()
  const dbStatus = useDb((s) => s.status)
  const dataVersion = useDb((s) => s.dataVersion)
  const schema = useDb((s) => s.schema)

  const [anomalies, setAnomalies] = useState<DataAnomaly[]>([])
  const [analyses, setAnalyses] = useState<Record<string, AnalysisState>>({})
  const [open, setOpen] = useState(false)
  const autoRanRef = useRef<Set<string>>(new Set())

  const apiKey = active?.apiKey
  const model = active?.model

  // Re-detect whenever the dataset changes (and clear prior analyses).
  useEffect(() => {
    if (dbStatus !== 'ready') {
      setAnomalies([])
      return
    }
    try {
      setAnomalies(detectAnomalies())
    } catch {
      setAnomalies([])
    }
    setAnalyses({})
    autoRanRef.current = new Set()
  }, [dbStatus, dataVersion])

  const runAnalysis = useCallback(
    async (anomaly: DataAnomaly) => {
      if (!apiKey || !model) {
        setAnalyses((a) => ({
          ...a,
          [anomaly.signature]: { status: 'error', error: 'Configure an OpenRouter provider first.' },
        }))
        return
      }
      setAnalyses((a) => ({ ...a, [anomaly.signature]: { status: 'loading' } }))
      try {
        const text = await analyzeAnomaly(anomaly, { apiKey, model, schema })
        setAnalyses((a) => ({ ...a, [anomaly.signature]: { status: 'done', text } }))
      } catch (e) {
        setAnalyses((a) => ({
          ...a,
          [anomaly.signature]: {
            status: 'error',
            error: e instanceof Error ? e.message : String(e),
          },
        }))
      }
    },
    [apiKey, model, schema],
  )

  // Auto-analyze each newly-detected anomaly once (when a provider is set).
  useEffect(() => {
    if (!apiKey || !model) return
    for (const anomaly of anomalies) {
      if (autoRanRef.current.has(anomaly.signature)) continue
      autoRanRef.current.add(anomaly.signature)
      void runAnalysis(anomaly)
    }
  }, [anomalies, apiKey, model, runAnalysis])

  const count = anomalies.length

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => setOpen(true)}
        disabled={dbStatus !== 'ready'}
      >
        <TriangleAlert className={cn('size-3.5', count > 0 && 'text-amber-500')} />
        Analyze
        <Badge variant={count > 0 ? 'destructive' : 'secondary'} className="h-4 px-1.5 text-[10px]">
          {count}
        </Badge>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Anomaly analysis</DialogTitle>
            <DialogDescription>
              Anomalies found in the current data, auto-analyzed with the active model.
            </DialogDescription>
          </DialogHeader>

          {count === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No anomalies detected in the current dataset.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {anomalies.map((anomaly) => {
                const analysis = analyses[anomaly.signature]
                return (
                  <div key={anomaly.signature} className="rounded-lg border">
                    <div className="border-b bg-muted/30 px-3 py-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <TriangleAlert className="size-3.5 text-amber-500" />
                        {anomaly.title}
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{anomaly.summary}</p>
                    </div>

                    <div className="overflow-auto px-3 py-2">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr>
                            {anomaly.sample.columns.map((c) => (
                              <th key={c} className="px-2 py-1 text-left font-medium">
                                {c}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {anomaly.sample.rows.map((row, i) => (
                            <tr key={i} className="border-t">
                              {row.map((cell, j) => (
                                <td key={j} className="px-2 py-0.5 font-mono">
                                  {cell === null ? 'NULL' : String(cell)}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div className="border-t px-3 py-2">
                      {!analysis && (
                        <Button
                          size="sm"
                          variant="secondary"
                          className="gap-1.5"
                          disabled={!apiKey || !model}
                          onClick={() => void runAnalysis(anomaly)}
                        >
                          <Sparkles className="size-3.5" />
                          {apiKey && model ? 'Analyze with AI' : 'Configure a provider to analyze'}
                        </Button>
                      )}
                      {analysis?.status === 'loading' && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" />
                          Analyzing…
                        </div>
                      )}
                      {analysis?.status === 'error' && (
                        <p className="text-sm text-destructive">{analysis.error}</p>
                      )}
                      {analysis?.status === 'done' && (
                        <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                          {analysis.text}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
