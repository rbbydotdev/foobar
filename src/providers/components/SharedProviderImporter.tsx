import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { useProviders } from '../store'
import type { SharePayload } from '../types'
import { decodeProviderParam, stripProviderParam } from '../share'

/**
 * On load, imports a provider from a ?provider= link:
 * - identical provider already saved → just activate it,
 * - no providers saved → add it,
 * - a provider exists but the link carries a *different* key → ask first.
 * Following a link always enables AI autocomplete and saves the key.
 */
export function SharedProviderImporter() {
  const [pending, setPending] = useState<SharePayload | null>(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true

    const payload = decodeProviderParam(window.location.search)
    if (!payload) return
    stripProviderParam()

    const store = useProviders.getState()
    const exact = store.providers.find(
      (p) => p.apiKey === payload.apiKey && p.model === payload.model,
    )
    if (exact) {
      store.setActiveProvider(exact.id)
      store.setAutocompleteEnabled(true)
      toast.success(`Switched to “${exact.label}”`, { description: payload.model })
      return
    }
    if (store.providers.length === 0) {
      const record = store.addProvider(payload)
      store.setActiveProvider(record.id)
      store.setAutocompleteEnabled(true)
      toast.success(`Added “${payload.label}”`, { description: payload.model })
      return
    }
    // A provider is already stored with a different key — confirm before changing.
    setPending(payload)
  }, [])

  function overwrite() {
    if (!pending) return
    const store = useProviders.getState()
    const target =
      store.providers.find((p) => p.id === store.activeProviderId) ?? store.providers[0]
    if (target) {
      store.updateProvider(target.id, {
        label: pending.label,
        apiKey: pending.apiKey,
        model: pending.model,
      })
      store.setActiveProvider(target.id)
    } else {
      const record = store.addProvider(pending)
      store.setActiveProvider(record.id)
    }
    store.setAutocompleteEnabled(true)
    toast.success('Provider updated from link', { description: pending.model })
    setPending(null)
  }

  function addNew() {
    if (!pending) return
    const store = useProviders.getState()
    const record = store.addProvider(pending)
    store.setActiveProvider(record.id)
    store.setAutocompleteEnabled(true)
    toast.success(`Added “${pending.label}”`, { description: pending.model })
    setPending(null)
  }

  return (
    <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Use the provider from this link?</AlertDialogTitle>
          <AlertDialogDescription>
            You already have an OpenRouter provider saved, and this link carries a{' '}
            <span className="font-medium text-foreground">different API key</span>
            {pending ? (
              <>
                {' '}
                for <span className="font-medium text-foreground">{pending.label}</span> (
                <span className="font-mono">{pending.model}</span>).
              </>
            ) : (
              '.'
            )}{' '}
            Replace your current key, add it as a separate provider, or keep what you have.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="sm:justify-between">
          <AlertDialogCancel>Keep current</AlertDialogCancel>
          <div className="flex gap-2">
            <Button variant="outline" onClick={addNew}>
              Add as new
            </Button>
            <AlertDialogAction onClick={overwrite}>Use new key</AlertDialogAction>
          </div>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
