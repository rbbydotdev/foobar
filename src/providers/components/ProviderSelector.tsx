import { useState } from 'react'
import { ChevronDown, CircleDot, Plus, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { cn } from '@/lib/utils'
import { useProviders } from '../store'

export interface ProviderSelectorProps {
  onAdd: () => void
  onManage: () => void
}

export function ProviderSelector({ onAdd, onManage }: ProviderSelectorProps) {
  const providers = useProviders((s) => s.providers)
  const activeProviderId = useProviders((s) => s.activeProviderId)
  const setActiveProvider = useProviders((s) => s.setActiveProvider)
  const [open, setOpen] = useState(false)

  const active = providers.find((p) => p.id === activeProviderId)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-between">
          <span className="truncate">{active ? active.label : 'No provider'}</span>
          <ChevronDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0" align="start">
        <Command>
          {providers.length > 3 && <CommandInput placeholder="Search providers…" />}
          <CommandList>
            <CommandEmpty>No providers configured.</CommandEmpty>
            {providers.length > 0 && (
              <CommandGroup>
                {providers.map((provider) => (
                  <CommandItem
                    key={provider.id}
                    value={`${provider.label} ${provider.model}`}
                    onSelect={() => {
                      setActiveProvider(provider.id)
                      setOpen(false)
                    }}
                    className="gap-2.5"
                  >
                    <CircleDot
                      className={cn(
                        'size-2.5 shrink-0',
                        provider.id === activeProviderId ? 'text-primary' : 'text-muted-foreground/40',
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{provider.label}</div>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {provider.model || 'no model'}
                      </div>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
          <CommandSeparator />
          <div className="flex items-center gap-1 p-1.5">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-1.5"
              onClick={() => {
                setOpen(false)
                onAdd()
              }}
            >
              <Plus className="size-3.5" />
              Add provider
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Manage providers"
              onClick={() => {
                setOpen(false)
                onManage()
              }}
            >
              <Settings className="size-3.5" />
            </Button>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
