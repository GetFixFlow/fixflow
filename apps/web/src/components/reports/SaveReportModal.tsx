import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useCreateSavedReport, useSavedReports, useUpdateSavedReport } from '@/hooks/useSavedReports'
import { filtersSummary, PERIOD_LABELS, SEND_HOUR, weekdayName } from '@/lib/savedReports'
import { useAuthStore } from '@/stores/authStore'
import type { SavedReport, SavedReportFilters, SavedReportKind, SavedReportPeriod } from '@/types/savedReports'

interface SaveReportModalProps {
  report: SavedReportKind
  /** Changing this one; omit to save a new one with `filters`. */
  saved?: SavedReport
  /** The filters to keep (a new one only; a saved report keeps its own). */
  filters?: SavedReportFilters
  onClose: () => void
  onSaved?: (saved: SavedReport) => void
}

const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

/** Saving a report's filters under a name, and choosing whether it is emailed every week, and to whom. */
export function SaveReportModal({ report, saved, filters = {}, onClose, onSaved }: SaveReportModalProps) {
  const me = useAuthStore((s) => s.user)
  const { data } = useSavedReports()
  const create = useCreateSavedReport()
  const update = useUpdateSavedReport()
  const people = data?.eligible_recipients ?? []

  const [name, setName] = useState(saved?.name ?? '')
  const [period, setPeriod] = useState<SavedReportPeriod>(saved?.period ?? 'last_30_days')
  const [emailed, setEmailed] = useState(saved ? saved.send_on !== null : false)
  const [day, setDay] = useState(saved?.send_on ?? 1)
  const [chosen, setChosen] = useState<number[]>(saved?.recipient_ids ?? (me ? [me.id] : []))
  const [problem, setProblem] = useState('')

  const kept = saved?.filters ?? filters
  const pending = create.isPending || update.isPending

  const toggle = (id: number) => setChosen((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim() === '') return setProblem('Give it a name.')
    if (emailed && chosen.length === 0) return setProblem('Choose at least one person to email it to.')
    setProblem('')

    const schedule = { send_on: emailed ? day : null, recipient_ids: emailed ? chosen : [] }
    const done = (result: { data: { data: SavedReport } }) => {
      onSaved?.(result.data.data)
      onClose()
    }
    if (saved) {
      update.mutate({ id: saved.id, changes: { name: name.trim(), period, ...schedule } }, { onSuccess: done })
    } else {
      create.mutate({ name: name.trim(), report, period, filters: kept, ...schedule }, { onSuccess: done })
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={saved ? 'Change saved report' : 'Save this view'}
      description={saved ? undefined : 'Keeps the filters you have chosen under a name, to come back to.'}
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Input id="sr-name" label="Name *" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="Weekly review, Plant 2" />

        <div>
          <label htmlFor="sr-period" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Period</label>
          <select id="sr-period" value={period} onChange={(e) => setPeriod(e.target.value as SavedReportPeriod)} className={SELECT_CLASS}>
            {(Object.keys(PERIOD_LABELS) as SavedReportPeriod[]).map((p) => <option key={p} value={p}>{PERIOD_LABELS[p]}</option>)}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">It moves with the calendar. The last days are the whole days before today.</p>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">Filters: {filtersSummary(kept)}</p>

        <div className="space-y-3 rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-800 dark:text-gray-200">
            <input type="checkbox" checked={emailed} onChange={(e) => setEmailed(e.target.checked)} className="h-4 w-4 rounded border-gray-300" />
            Email it as a PDF every week
          </label>
          {emailed && (
            <>
              <div>
                <label htmlFor="sr-day" className="mb-1.5 block text-sm text-gray-700 dark:text-gray-300">On</label>
                <select id="sr-day" value={day} onChange={(e) => setDay(Number(e.target.value))} className={SELECT_CLASS}>
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => <option key={d} value={d}>{weekdayName(d)}</option>)}
                </select>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">From {SEND_HOUR}:00 in the morning, company time.</p>
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm text-gray-700 dark:text-gray-300">To</legend>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {people.map((person) => (
                    <label key={person.id} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={chosen.includes(person.id)} onChange={() => toggle(person.id)} className="h-4 w-4 rounded border-gray-300" />
                      {person.full_name} <span className="text-xs text-gray-500 dark:text-gray-400">{person.role}</span>
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Only managers and administrators: a report shows what work cost.</p>
              </fieldset>
            </>
          )}
        </div>

        {problem && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{problem}</p>}

        <div className="flex gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="submit" disabled={pending} className="flex-1">{pending ? 'Saving…' : saved ? 'Save changes' : 'Save view'}</Button>
        </div>
      </form>
    </Modal>
  )
}
