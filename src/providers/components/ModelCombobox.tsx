import { useState } from 'react'
import { Check, ChevronsUpDown, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useOpenRouterModels } from '../use-models'

function formatContext(n?: number): string {
  if (!n) return ''
  return n >= 1000 ? `${Math.round(n / 1000)}k` : String(n)
}

export interface ModelComboboxProps {
  value: string
  onChange: (model: string) => void
  disabled?: boolean
  triggerClassName?: string
}

export function ModelCombobox({ value, onChange, disabled, triggerClassName }: ModelComboboxProps) {
  const { models, loading } = useOpenRouterModels()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const trimmed = search.trim()
  const exactMatch = models.some((m) => m.id === trimmed)

  function choose(model: string) {
    onChange(model)
    setOpen(false)
    setSearch('')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-mono text-xs', triggerClassName)}
        >
          <span className="truncate">
            {value || (loading ? 'Loading models…' : 'Select model…')}
          </span>
          <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[300px] p-0"
        align="start"
      >
        <Command>
          <CommandInput
            placeholder="Search models…"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>{loading ? 'Loading models…' : 'No models found.'}</CommandEmpty>
            {trimmed && !exactMatch && (
              <CommandGroup heading="Custom">
                <CommandItem value={trimmed} onSelect={() => choose(trimmed)} className="gap-2">
                  <Check className="size-3.5 opacity-0" />
                  <span className="flex-1 truncate font-mono text-xs">Use “{trimmed}”</span>
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={`${models.length} models`}>
              {models.map((model) => (
                <CommandItem
                  key={model.id}
                  value={model.id}
                  keywords={model.name ? [model.name] : undefined}
                  onSelect={() => choose(model.id)}
                  className="gap-2"
                >
                  <Check
                    className={cn('size-3.5 shrink-0', value === model.id ? 'opacity-100' : 'opacity-0')}
                  />
                  <span className="flex-1 truncate font-mono text-xs">{model.id}</span>
                  {model.tools && <Wrench className="size-3 shrink-0 text-primary" />}
                  {model.contextLength != null && (
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                      {formatContext(model.contextLength)}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
