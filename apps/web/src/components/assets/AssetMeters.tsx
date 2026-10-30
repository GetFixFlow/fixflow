import { useState } from 'react'
import { Gauge, History, Plus, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import type { Meter } from '@/api/meters'
import { useAssetMeters, useCreateMeter, useDeleteMeter, useMeterReadings, useRecordReading } from '@/hooks/useMeters'
import { formatDate } from '@/lib/localeFormat'

const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })

function AddMeterModal({ assetId, open, onClose }: { assetId: number; open: boolean; onClose: () => void }) {
  const create = useCreateMeter(assetId)
  const [name, setName] = useState('Running hours')
  const [unit, setUnit] = useState('hours')
  const [reading, setReading] = useState('')
  const [sensor, setSensor] = useState('')

  const save = () =>
    create.mutate(
      { name, unit, reading: reading || undefined, sensor_metric: sensor || null },
      { onSuccess: () => { setReading(''); setSensor(''); onClose() } },
    )

  return (
    <Modal open={open} onClose={onClose} title="Add a meter" description="Running hours, kilometres or cycles: whatever the maintenance is counted in.">
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="meter-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <Input id="meter-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="w-28">
            <label htmlFor="meter-unit" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Unit</label>
            <Input id="meter-unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="meter-reading" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Reading today</label>
          <Input id="meter-reading" type="number" min={0} step="any" value={reading} onChange={(e) => setReading(e.target.value)} placeholder="0" />
          <p className="mt-1 text-xs text-gray-500">Where the machine stands now. A machine with 4,120 hours on it starts at 4,120.</p>
        </div>
        <div>
          <label htmlFor="meter-sensor" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Fed by a sensor (optional)</label>
          <Input id="meter-sensor" value={sensor} onChange={(e) => setSensor(e.target.value)} placeholder="running_hours" />
          <p className="mt-1 text-xs text-gray-500">The sensor metric whose value is this meter's reading. It must count up (a running total). Leave empty to read it by hand.</p>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={create.isPending} disabled={!name.trim() || !unit.trim()}>Add meter</Button>
        </div>
      </div>
    </Modal>
  )
}

function ReadingModal({ meter, canReset, open, onClose }: { meter: Meter; canReset: boolean; open: boolean; onClose: () => void }) {
  const record = useRecordReading(meter.id)
  const [value, setValue] = useState('')
  const [note, setNote] = useState('')
  const [reset, setReset] = useState(false)

  const save = () =>
    record.mutate(
      { value, note: note || undefined, reset: reset || undefined },
      { onSuccess: () => { setValue(''); setNote(''); setReset(false); onClose() } },
    )

  return (
    <Modal open={open} onClose={onClose} title={`Record a reading: ${meter.name}`}
      description={`It reads ${number(meter.reading)} ${meter.unit} now.`}>
      <div className="space-y-3">
        <div>
          <label htmlFor={`reading-${meter.id}`} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">New reading ({meter.unit})</label>
          <Input id={`reading-${meter.id}`} type="number" min={0} step="any" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
        </div>
        <div>
          <label htmlFor={`note-${meter.id}`} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Note (optional)</label>
          <Input id={`note-${meter.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {canReset && (
          <label className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" className="mt-1" checked={reset} onChange={(e) => setReset(e.target.checked)} />
            <span>The meter was replaced or reset, so this reading is lower. Maintenance that follows it starts counting again from here.</span>
          </label>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} loading={record.isPending} disabled={value.trim() === ''}>Save reading</Button>
        </div>
      </div>
    </Modal>
  )
}

function ReadingHistory({ meter }: { meter: Meter }) {
  const { data, isLoading } = useMeterReadings(meter.id, true)
  if (isLoading) return <Skeleton className="mt-3 h-16 w-full" />
  if (!data?.length) return <p className="mt-3 text-sm text-gray-500">No readings yet.</p>
  return (
    <table className="mt-3 w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-gray-500"><th className="py-1">When</th><th>Reading</th><th>By</th><th>Note</th></tr>
      </thead>
      <tbody>
        {data.map((line) => (
          <tr key={line.id} className="border-t border-gray-100 dark:border-gray-700">
            <td className="py-1.5">{formatDate(new Date(line.recorded_at))}</td>
            <td>{number(line.value)} {meter.unit}{line.reset ? ' (reset)' : ''}</td>
            <td>{line.source === 'sensor' ? 'Sensor' : line.recorded_by ?? '—'}</td>
            <td className="text-gray-500">{line.note ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function MeterCard({ meter, canManage }: { meter: Meter; canManage: boolean }) {
  const [recording, setRecording] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const remove = useDeleteMeter(meter.id)

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{meter.name}</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {number(meter.reading)} <span className="text-base font-medium text-gray-500">{meter.unit}</span>
            </p>
            <p className="text-xs text-gray-500">
              {meter.last_reading_at ? `Read ${formatDistanceToNow(new Date(meter.last_reading_at), { addSuffix: true })}` : 'Not read yet'}
              {meter.sensor_metric && ` · fed by the sensor “${meter.sensor_metric}”`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setRecording(true)}><Gauge className="mr-1.5 h-4 w-4" />Record reading</Button>
            <Button size="sm" variant="outline" onClick={() => setShowHistory((v) => !v)}><History className="mr-1.5 h-4 w-4" />History</Button>
            {canManage && (
              <Button size="sm" variant="outline" aria-label={`Delete ${meter.name}`}
                onClick={() => { if (window.confirm(`Delete the meter “${meter.name}” and its readings?`)) remove.mutate(undefined) }}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        {showHistory && <ReadingHistory meter={meter} />}
      </CardContent>
      <ReadingModal meter={meter} canReset={canManage} open={recording} onClose={() => setRecording(false)} />
    </Card>
  )
}

/** The meters of an asset: readings by hand (or from a sensor) and their history. */
export function AssetMeters({ assetId, canManage }: { assetId: number; canManage: boolean }) {
  const { data: meters, isLoading, isError } = useAssetMeters(assetId)
  const [adding, setAdding] = useState(false)

  if (isLoading) return <Skeleton className="h-24 w-full" />
  if (isError) return <p className="text-sm text-red-600">The meters could not be loaded.</p>

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Hours, kilometres or cycles. Maintenance can fall due when a meter reaches a reading, instead of on a date.
        </p>
        {canManage && <Button size="sm" onClick={() => setAdding(true)}><Plus className="mr-1.5 h-4 w-4" />Add meter</Button>}
      </div>
      {meters?.length ? (
        meters.map((meter) => <MeterCard key={meter.id} meter={meter} canManage={canManage} />)
      ) : (
        <EmptyState icon={Gauge} title="No meters yet"
          description={canManage ? 'Add a meter to count running hours, kilometres or cycles on this asset.' : 'A manager can add a meter to this asset.'} />
      )}
      <AddMeterModal assetId={assetId} open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
