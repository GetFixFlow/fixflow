import { useState } from 'react'
import { AlertTriangle, CirclePlay, OctagonX, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { Skeleton } from '@/components/ui/Skeleton'
import { useDeleteDowntime, useDowntimes, useRecordDowntime, useRestart, useUpdateDowntime } from '@/hooks/useDowntimes'
import { formatDateTime } from '@/lib/localeFormat'
import { fromInputValue, toInputValue } from '@/lib/dateTimeInput'
import { formatHours } from '@/utils/chartUtils'
import type { Downtime } from '@/types'

const LABEL = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'

/** It stopped: now, earlier today, or a stop that is over (when it ran again is filled in). */
function StoppedModal({ assetId, open, onClose }: { assetId: number; open: boolean; onClose: () => void }) {
  const record = useRecordDowntime(assetId)
  const [startedAt, setStartedAt] = useState(() => toInputValue(new Date()))
  const [endedAt, setEndedAt] = useState('')
  const [reason, setReason] = useState('')

  const save = () =>
    record.mutate(
      { started_at: fromInputValue(startedAt), ended_at: fromInputValue(endedAt), reason: reason.trim() || null },
      { onSuccess: () => { setStartedAt(toInputValue(new Date())); setEndedAt(''); setReason(''); onClose() } },
    )

  return (
    <Modal open={open} onClose={onClose} title="It stopped"
      description="Leave 'Running again' empty if it is down now. Fill it in to record a stop that is already over.">
      <div className="space-y-3">
        <div>
          <label htmlFor="downtime-started" className={LABEL}>Stopped</label>
          <Input id="downtime-started" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </div>
        <div>
          <label htmlFor="downtime-ended" className={LABEL}>Running again (optional)</label>
          <Input id="downtime-ended" type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
        </div>
        <div>
          <label htmlFor="downtime-reason" className={LABEL}>What happened (optional)</label>
          <Input id="downtime-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Belt snapped" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={record.isPending} disabled={!startedAt}>
            {endedAt ? 'Record the stop' : 'Mark as down'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** It runs again: now, or at an earlier time. */
function RestartModal({ downtime, open, onClose }: { downtime: Downtime; open: boolean; onClose: () => void }) {
  const restart = useRestart()
  const [endedAt, setEndedAt] = useState(() => toInputValue(new Date()))

  return (
    <Modal open={open} onClose={onClose} title="It is running again"
      description="The asset's status goes back to operational. Change the time if it was running before you recorded it.">
      <div className="space-y-3">
        <div>
          <label htmlFor="downtime-restarted" className={LABEL}>Running again from</label>
          <Input id="downtime-restarted" type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={restart.isPending} disabled={!endedAt}
            onClick={() => restart.mutate({ id: downtime.id, endedAt: fromInputValue(endedAt) }, { onSuccess: onClose })}>
            Back in service
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** A manager corrects the times and the note. The end of a stop that is still going on is set by restarting it. */
function EditModal({ downtime, open, onClose }: { downtime: Downtime; open: boolean; onClose: () => void }) {
  const update = useUpdateDowntime(downtime.id)
  const [startedAt, setStartedAt] = useState(() => toInputValue(downtime.started_at))
  const [endedAt, setEndedAt] = useState(() => (downtime.ended_at ? toInputValue(downtime.ended_at) : ''))
  const [reason, setReason] = useState(downtime.reason ?? '')

  return (
    <Modal open={open} onClose={onClose} title="Correct this downtime">
      <div className="space-y-3">
        <div>
          <label htmlFor="edit-started" className={LABEL}>Stopped</label>
          <Input id="edit-started" type="datetime-local" value={startedAt} onChange={(e) => setStartedAt(e.target.value)} />
        </div>
        {!downtime.open && (
          <div>
            <label htmlFor="edit-ended" className={LABEL}>Running again</label>
            <Input id="edit-ended" type="datetime-local" value={endedAt} onChange={(e) => setEndedAt(e.target.value)} />
          </div>
        )}
        <div>
          <label htmlFor="edit-reason" className={LABEL}>What happened</label>
          <Input id="edit-reason" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button loading={update.isPending} disabled={!startedAt}
            onClick={() => update.mutate(
              { started_at: fromInputValue(startedAt), ended_at: downtime.open ? undefined : fromInputValue(endedAt), reason: reason.trim() || null },
              { onSuccess: onClose },
            )}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function DowntimeRow({ downtime, canManage }: { downtime: Downtime; canManage: boolean }) {
  const [editing, setEditing] = useState(false)
  const remove = useDeleteDowntime()
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {formatDateTime(downtime.started_at)} → {downtime.ended_at ? formatDateTime(downtime.ended_at) : <span className="text-red-600">still down</span>}
          <span className="ml-2 font-normal text-gray-500">{formatHours(downtime.hours)}</span>
        </p>
        {downtime.reason && <p className="text-sm text-gray-700 dark:text-gray-300">{downtime.reason}</p>}
        <p className="text-xs text-gray-500">
          {downtime.started_by ? `Stopped by ${downtime.started_by}` : 'Recorded by the status'}
          {downtime.ended_by && `, restarted by ${downtime.ended_by}`}
        </p>
      </div>
      {canManage && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" aria-label="Correct this downtime" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
          {!downtime.open && (
            <Button size="sm" variant="outline" aria-label="Delete this downtime"
              onClick={() => { if (window.confirm('Delete this downtime? The reports will no longer count it.')) remove.mutate(downtime.id) }}>
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
      {editing && <EditModal downtime={downtime} open onClose={() => setEditing(false)} />}
    </li>
  )
}

/** When the asset stopped and ran again. Anyone who works on it can record a stop or a restart; a manager can correct or delete. */
export function AssetDowntime({ assetId, canManage }: { assetId: number; canManage: boolean }) {
  const { data: downtimes, isLoading, isError } = useDowntimes(assetId)
  const [stopping, setStopping] = useState(false)
  const [restarting, setRestarting] = useState(false)

  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (isError) return <p className="text-sm text-red-600">The downtime could not be loaded.</p>

  const current = downtimes?.find((downtime) => downtime.open)

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500 dark:text-gray-400">
        When this asset stopped and ran again. Marking it down (here or in its status) starts the clock; the Downtime report works out
        availability and the time between failures from these.
      </p>
      {current ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="flex items-center gap-2 text-sm text-red-800 dark:text-red-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Down since {formatDateTime(current.started_at)} ({formatHours(current.hours)}){current.reason ? `: ${current.reason}` : ''}</span>
          </div>
          <Button size="sm" onClick={() => setRestarting(true)}><CirclePlay className="mr-1.5 h-4 w-4" />Running again</Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setStopping(true)}><OctagonX className="mr-1.5 h-4 w-4" />It stopped</Button>
        </div>
      )}
      {downtimes?.length ? (
        <Card>
          <CardContent className="p-4">
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {downtimes.map((downtime) => <DowntimeRow key={downtime.id} downtime={downtime} canManage={canManage} />)}
            </ul>
          </CardContent>
        </Card>
      ) : (
        <EmptyState icon={OctagonX} title="No downtime recorded" description="When this asset stops, mark it down and note what happened. It will show here and in the reports." />
      )}
      {stopping && <StoppedModal assetId={assetId} open onClose={() => setStopping(false)} />}
      {restarting && current && <RestartModal downtime={current} open onClose={() => setRestarting(false)} />}
    </div>
  )
}
