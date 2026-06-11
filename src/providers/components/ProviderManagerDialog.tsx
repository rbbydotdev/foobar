import { useState } from 'react'
import { toast } from 'sonner'
import { Check, Pencil, Plus, Share2, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useProviders } from '../store'
import { buildShareLink } from '../share'
import type { ProviderRecord } from '../types'
import { ProviderForm } from './ProviderForm'

export interface ProviderManagerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

async function copyShareLink(provider: ProviderRecord) {
  try {
    await navigator.clipboard.writeText(buildShareLink(provider))
    toast.success('Share link copied', {
      description: 'Includes the API key and model — share carefully.',
    })
  } catch {
    toast.error('Could not copy to clipboard')
  }
}

export function ProviderManagerDialog({ open, onOpenChange }: ProviderManagerDialogProps) {
  const providers = useProviders((s) => s.providers)
  const activeProviderId = useProviders((s) => s.activeProviderId)
  const addProvider = useProviders((s) => s.addProvider)
  const updateProvider = useProviders((s) => s.updateProvider)
  const removeProvider = useProviders((s) => s.removeProvider)
  const setActiveProvider = useProviders((s) => s.setActiveProvider)

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<ProviderRecord | null>(null)

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  function handleSubmit(data: { label: string; apiKey: string; model: string }) {
    if (editing) {
      updateProvider(editing.id, data)
      toast.success('Provider updated')
    } else {
      addProvider(data)
      toast.success('Provider added')
    }
    closeForm()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeForm()
        onOpenChange(next)
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {showForm ? (editing ? 'Edit provider' : 'Add OpenRouter provider') : 'OpenRouter providers'}
          </DialogTitle>
          <DialogDescription>
            {showForm
              ? 'Provide a label, your OpenRouter API key, and a model.'
              : 'Saved locally in your browser. Share a provider to hand teammates a ready-to-go link.'}
          </DialogDescription>
        </DialogHeader>

        {showForm ? (
          <ProviderForm initial={editing ?? undefined} onSubmit={handleSubmit} onCancel={closeForm} />
        ) : (
          <div className="flex flex-col gap-3">
            {providers.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center">
                <p className="text-sm text-muted-foreground">No providers yet</p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Add an OpenRouter key to enable AI autocomplete.
                </p>
              </div>
            ) : (
              <div className="divide-y rounded-md border">
                {providers.map((provider) => {
                  const active = provider.id === activeProviderId
                  return (
                    <div key={provider.id} className="flex items-center gap-3 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => setActiveProvider(provider.id)}
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-full border',
                          active ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
                        )}
                        title={active ? 'Active' : 'Set active'}
                      >
                        {active && <Check className="size-2.5" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium">{provider.label}</div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">
                          {provider.model || 'no model'}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        <IconAction label="Share link" onClick={() => void copyShareLink(provider)}>
                          <Share2 className="size-3.5" />
                        </IconAction>
                        <IconAction
                          label="Edit"
                          onClick={() => {
                            setEditing(provider)
                            setShowForm(true)
                          }}
                        >
                          <Pencil className="size-3.5" />
                        </IconAction>
                        <IconAction label="Delete" onClick={() => removeProvider(provider.id)}>
                          <Trash2 className="size-3.5 text-destructive/70" />
                        </IconAction>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <Button
              size="sm"
              className="gap-1.5 self-start"
              onClick={() => {
                setEditing(null)
                setShowForm(true)
              }}
            >
              <Plus className="size-3.5" />
              Add provider
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function IconAction({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon-xs" onClick={onClick} aria-label={label}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
