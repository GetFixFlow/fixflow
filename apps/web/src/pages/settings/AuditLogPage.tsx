import { useEffect, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { Download, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { useAuthStore } from '@/stores/authStore'
import { auditApi, type AuditFilters, type AuditLine } from '@/api/audit'
import { isAxiosError } from 'axios'
import { triggerDownload } from '@/services/exportService'
import { changedFields, describeAction, RECORD_TYPES, removalSummary, roleChange, VERBS } from '@/lib/auditText'
import { formatDateTime } from '@/lib/localeFormat'

/** The text, once it has stopped changing for a moment, so typing does not ask the server for every letter. */
function useSettled(value: string, ms = 300) {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(timer)
  }, [value, ms])
  return settled
}

const FIELD = 'h-9 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 text-sm'

function Who({ line }: { line: AuditLine }) {
  if (!line.user) return <span className="text-xs italic text-gray-500">System</span>
  return (
    <>
      <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{line.user.full_name}</p>
      <p className="text-xs text-gray-400">{line.user.email}</p>
    </>
  )
}

function Details({ line }: { line: AuditLine }) {
  const fields = changedFields(line)
  const role = roleChange(line)
  const removed = removalSummary(line)
  if (fields.length === 0 && !role && !removed) return <span className="text-xs text-gray-400">—</span>
  return (
    <div className="text-xs text-gray-600 dark:text-gray-400">
      {removed && <p>{removed}</p>}
      {fields.length > 0 && <p>Changed: {fields.join(', ')}</p>}
      {role && <p>Role: {role}</p>}
    </div>
  )
}

export function AuditLogPage() {
  const { user } = useAuthStore()
  const [person, setPerson] = useState('')
  const [search, setSearch] = useState('')
  const [recordType, setRecordType] = useState('')
  const [verb, setVerb] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState(false)

  const filters: AuditFilters = { person: useSettled(person), q: useSettled(search), resource_type: recordType, verb, from, to }
  // A new search starts at the first page.
  const filterKey = JSON.stringify(filters)
  const [shownFor, setShownFor] = useState(filterKey)
  if (shownFor !== filterKey) {
    setShownFor(filterKey)
    setPage(1)
  }

  const { data, isLoading, isError, isFetching } = useQuery({
    queryKey: ['audit_log', filterKey, page],
    queryFn: () => auditApi.list(filters, page),
    placeholderData: keepPreviousData,
    enabled: user?.role === 'admin',
  })

  if (user?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <PageHeader title="Audit Log" description="Who did what, and when" />
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-gray-500">Only administrators can see the audit log.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const lines = data?.activity_logs ?? []
  const pagination = data?.meta.pagination

  const exportCsv = async () => {
    setExporting(true)
    try {
      const file = await auditApi.download(filters)
      triggerDownload(file.blob, file.filename)
      if (file.truncated) toast.warning('The file holds only the newest 50,000 lines. Narrow the dates or filters to get the rest.')
    } catch (error) {
      toast.error(isAxiosError(error) && error.response?.status === 403
        ? 'Only administrators can export the audit log.'
        : 'The audit log could not be exported. Try again.')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="Who created, changed or deleted the company's records, who signed in, and when. Newest first."
        actions={
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={exporting}>
            <Download className="mr-1.5 h-4 w-4" /> {exporting ? 'Preparing…' : 'Export CSV'}
          </Button>
        }
      />

      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
              <input type="text" aria-label="Person" placeholder="Person (name or email)" value={person}
                onChange={(e) => setPerson(e.target.value)} className={`${FIELD} pl-8`} />
            </div>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" aria-hidden="true" />
              <input type="text" aria-label="Record" placeholder="Record name (a work order, asset…)" value={search}
                onChange={(e) => setSearch(e.target.value)} className={`${FIELD} pl-8`} />
            </div>
            <select aria-label="Kind of record" value={recordType} onChange={(e) => setRecordType(e.target.value)} className={FIELD}>
              <option value="">Every kind of record</option>
              {Object.entries(RECORD_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <select aria-label="What happened" value={verb} onChange={(e) => setVerb(e.target.value)} className={FIELD}>
              <option value="">Anything that happened</option>
              {Object.entries(VERBS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              From <input type="date" aria-label="From date" value={from} onChange={(e) => setFrom(e.target.value)} className={FIELD} />
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-500">
              To <input type="date" aria-label="To date" value={to} onChange={(e) => setTo(e.target.value)} className={FIELD} />
            </label>
          </div>
        </CardContent>
      </Card>

      {isError && (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          The audit log could not be loaded. Try again in a moment.
        </p>
      )}

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50">
                <tr>
                  {['When', 'Who', 'What happened', 'Record', 'Details'].map((heading) => (
                    <th key={heading} className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">{heading}</th>
                  ))}
                  <th className="hidden px-4 py-3 text-left text-xs font-medium uppercase text-gray-500 md:table-cell">From</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {isLoading ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Loading…</td></tr>
                ) : lines.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">Nothing in the audit log matches these filters.</td></tr>
                ) : (
                  lines.map((line) => (
                    <tr key={line.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs text-gray-500">{formatDateTime(line.created_at)}</td>
                      <td className="px-4 py-2.5"><Who line={line} /></td>
                      <td className="px-4 py-2.5 text-xs font-medium text-gray-900 dark:text-gray-100">{describeAction(line.action)}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-xs text-gray-500">{line.resource_type ? (RECORD_TYPES[line.resource_type] ?? line.resource_type) : ''}</p>
                        <p className="text-xs text-gray-700 dark:text-gray-300">{line.resource_name}</p>
                      </td>
                      <td className="px-4 py-2.5"><Details line={line} /></td>
                      <td className="hidden px-4 py-2.5 font-mono text-xs text-gray-400 md:table-cell">{line.ip_address}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pagination && pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {pagination.current_page} of {pagination.total_pages} ({pagination.total_count} lines)
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= pagination.total_pages || isFetching} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  )
}
