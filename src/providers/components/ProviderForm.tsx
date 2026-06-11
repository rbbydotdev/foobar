import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ModelCombobox } from './ModelCombobox'
import type { ProviderRecord } from '../types'

export interface ProviderFormProps {
  initial?: ProviderRecord
  onSubmit: (data: { label: string; apiKey: string; model: string }) => void
  onCancel: () => void
}

export function ProviderForm({ initial, onSubmit, onCancel }: ProviderFormProps) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [apiKey, setApiKey] = useState(initial?.apiKey ?? '')
  const [model, setModel] = useState(initial?.model ?? '')
  const [revealKey, setRevealKey] = useState(false)

  const canSubmit = apiKey.trim().length > 0 && model.trim().length > 0

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSubmit) onSubmit({ label, apiKey, model })
      }}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="provider-label">Label</Label>
        <Input
          id="provider-label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="My OpenRouter key"
          className="h-8"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="provider-key">
          OpenRouter API key
          <a
            href="https://openrouter.ai/keys"
            target="_blank"
            rel="noreferrer"
            className="ml-2 text-xs font-normal text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            get one
          </a>
        </Label>
        <div className="relative">
          <Input
            id="provider-key"
            type={revealKey ? 'text' : 'password'}
            autoComplete="off"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-or-…"
            className="h-8 pr-8 font-mono"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRevealKey((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            {revealKey ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Stored locally in your browser. Demo only — never use a production key.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Model</Label>
        <ModelCombobox value={model} onChange={setModel} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {initial ? 'Save' : 'Add provider'}
        </Button>
      </div>
    </form>
  )
}
