import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { decodeProviderParam, stripProviderParam } from './share'
import { useProviders } from './store'

/**
 * On first load, imports a provider from the ?provider= link (if present and
 * not already saved), activates it, and clears the param from the URL.
 */
export function useImportSharedProvider(): void {
  const importSharedProvider = useProviders((s) => s.importSharedProvider)
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const payload = decodeProviderParam(window.location.search)
    if (!payload) return

    const { added } = importSharedProvider(payload)
    stripProviderParam()
    toast.success(
      added
        ? `Added shared provider “${payload.label}”`
        : `Switched to “${payload.label}” (already saved)`,
      { description: payload.model },
    )
  }, [importSharedProvider])
}
