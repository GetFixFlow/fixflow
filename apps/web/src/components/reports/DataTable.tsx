import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'

export interface DataTableColumn<T> {
  key: keyof T | string
  header: string
  render?: (row: T, index: number) => React.ReactNode
  sortable?: boolean
  className?: string
  headerClassName?: string
  align?: 'left' | 'right' | 'center'
}

interface DataTableProps<T> {
  data: T[]
  columns: DataTableColumn<T>[]
  keyField?: keyof T
  searchable?: boolean
  searchFields?: (keyof T)[]
  pageSize?: number
  loading?: boolean
  emptyText?: string
  onRowClick?: (row: T) => void
  className?: string
  compact?: boolean
}

type SortDir = 'asc' | 'desc' | null

export function DataTable<T extends Record<string, unknown>>({
  data, columns, keyField, searchable, searchFields, pageSize = 20, loading,
  emptyText = 'No data.', onRowClick, className, compact,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [page, setPage] = useState(1)

  const filtered = useMemo(() => {
    if (!search || !searchFields?.length) return data
    const q = search.toLowerCase()
    return data.filter((row) =>
      searchFields.some((f) => String(row[f] ?? '').toLowerCase().includes(q))
    )
  }, [data, search, searchFields])

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      const av = a[sortKey as keyof T], bv = b[sortKey as keyof T]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      const cmp = typeof av === 'number' && typeof bv === 'number'
        ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const paged = sorted.slice((page - 1) * pageSize, page * pageSize)

  const toggleSort = (key: string) => {
    if (sortKey !== key) { setSortKey(key); setSortDir('asc') }
    else if (sortDir === 'asc') setSortDir('desc')
    else { setSortKey(null); setSortDir(null) }
    setPage(1)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {searchable && (
        <div className="relative max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <Input placeholder="Search..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="pl-9 h-8 text-sm" />
        </div>
      )}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            <tr>
              {columns.map((col) => (
                <th key={String(col.key)} onClick={() => col.sortable && toggleSort(String(col.key))}
                  className={cn(
                    'px-3 py-2.5 text-left select-none',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    col.sortable && 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700',
                    col.headerClassName,
                  )}>
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortKey === String(col.key)
                        ? sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                        : <ChevronsUpDown className="h-3 w-3 text-gray-300" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((col) => (
                    <td key={String(col.key)} className="px-3 py-2">
                      <div className="h-4 rounded bg-gray-100 dark:bg-gray-800 animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : paged.length === 0 ? (
              <tr><td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">{emptyText}</td></tr>
            ) : paged.map((row, idx) => (
              <tr key={keyField ? String(row[keyField]) : idx}
                onClick={() => onRowClick?.(row)}
                className={cn('transition-colors', onRowClick && 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800', compact && 'text-xs')}>
                {columns.map((col) => (
                  <td key={String(col.key)} className={cn(
                    'px-3 py-2.5 text-gray-700 dark:text-gray-300',
                    col.align === 'right' && 'text-right',
                    col.align === 'center' && 'text-center',
                    compact && 'py-1.5',
                    col.className,
                  )}>
                    {col.render ? col.render(row, idx) : String(row[col.key as keyof T] ?? '—')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{sorted.length} results</span>
          <div className="flex items-center gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}
              className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">←</button>
            <span>Page {page} of {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)}
              className="px-2 py-1 rounded border disabled:opacity-40 hover:bg-gray-100">→</button>
          </div>
        </div>
      )}
    </div>
  )
}
