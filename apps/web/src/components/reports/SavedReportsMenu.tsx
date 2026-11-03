import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bookmark } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { SaveReportModal } from '@/components/reports/SaveReportModal'
import { useSavedReports, useUpdateSavedReport } from '@/hooks/useSavedReports'
import { applySavedReport } from '@/lib/applySavedReport'
import { filtersFromStore } from '@/lib/savedReports'
import { useReportStore } from '@/stores/reportStore'
import type { SavedReportKind } from '@/types/savedReports'

/**
 * Next to a report's Filters and Export buttons: pick a saved view to apply its filters and period, save the current
 * filters as a new one, or bring a view up to date with the filters now chosen.
 */
export function SavedReportsMenu({ report }: { report: SavedReportKind }) {
  const { data } = useSavedReports(report)
  const update = useUpdateSavedReport()
  const filters = useReportStore((s) => s.filters)
  const [selectedId, setSelectedId] = useState('')
  const [saving, setSaving] = useState(false)

  const views = data?.saved_reports ?? []
  const selected = views.find((view) => String(view.id) === selectedId)

  const choose = (id: string) => {
    setSelectedId(id)
    const view = views.find((v) => String(v.id) === id)
    if (view) applySavedReport(view)
  }

  return (
    <div className="flex items-center gap-2">
      {views.length > 0 && (
        <select
          aria-label="Saved views"
          value={selectedId}
          onChange={(e) => choose(e.target.value)}
          className="h-9 max-w-[12rem] rounded-md border border-gray-300 bg-white px-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
        >
          <option value="">Saved views</option>
          {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
        </select>
      )}
      {selected?.editable && (
        <Button
          variant="outline"
          size="sm"
          disabled={update.isPending}
          onClick={() => update.mutate({ id: selected.id, changes: { filters: filtersFromStore(filters) } })}
        >
          Update filters
        </Button>
      )}
      <Button variant="outline" onClick={() => setSaving(true)}><Bookmark className="mr-1.5 h-4 w-4" />Save view</Button>
      <Link to="/reports/saved" className="text-sm text-brand-600 hover:underline dark:text-brand-400">Manage</Link>
      {saving && (
        <SaveReportModal
          report={report}
          filters={filtersFromStore(filters)}
          onClose={() => setSaving(false)}
          onSaved={(saved) => setSelectedId(String(saved.id))}
        />
      )}
    </div>
  )
}
