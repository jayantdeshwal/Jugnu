import { useEffect, useState } from 'react'
import { fallbackCatalog, fetchPublicCatalog, PublicCatalog } from '@/services/catalog'

export function usePublicCatalog() {
  const [catalog, setCatalog] = useState<PublicCatalog>(fallbackCatalog)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    let isMounted = true

    fetchPublicCatalog()
      .then(nextCatalog => {
        if (isMounted) setCatalog(nextCatalog)
      })
      .catch(nextError => {
        if (isMounted) setError(nextError instanceof Error ? nextError : new Error('Unable to load catalog'))
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  return { ...catalog, isLoading, error }
}
