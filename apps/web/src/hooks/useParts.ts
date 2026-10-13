import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { partsApi } from '@/api/parts'

/** The part catalog, optionally narrowed by name or SKU. */
export function useParts(search = '', enabled = true) {
  return useQuery({
    queryKey: ['parts', search],
    queryFn: () => partsApi.list({ search: search || undefined }).then((r) => r.data.parts),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** A value that only changes after it has stopped changing for `delay` ms, so typing does not search every key. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}
