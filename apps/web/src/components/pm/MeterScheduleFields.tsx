import { Link } from 'react-router-dom'
import { Input } from '@/components/ui/Input'
import { useAssetMeters } from '@/hooks/useMeters'

const number = (value: number) => value.toLocaleString(undefined, { maximumFractionDigits: 2 })

interface Props {
  assetId: number | undefined
  meterId: number | undefined
  onMeter: (id: number | undefined) => void
  value: number
  onValue: (value: number) => void
  lastService: string
  onLastService: (reading: string) => void
}

/** "Every 250 hours of this meter": which meter, how often, and where the last service was. */
export function MeterScheduleFields({ assetId, meterId, onMeter, value, onValue, lastService, onLastService }: Props) {
  const { data: meters, isLoading } = useAssetMeters(assetId)
  const meter = meters?.find((m) => m.id === meterId)
  const base = lastService.trim() !== '' && !Number.isNaN(Number(lastService)) ? Number(lastService) : meter?.reading
  const select = 'w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500'

  if (!assetId) return <p className="text-sm text-gray-500">Choose the asset first (step 1): a schedule follows one of its meters.</p>
  if (isLoading) return <p className="text-sm text-gray-500">Loading the asset's meters…</p>
  if (!meters?.length) {
    return (
      <p className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
        This asset has no meters yet. <Link className="font-medium underline" to={`/assets/${assetId}`}>Open the asset</Link>, choose the Meters tab and add one
        (running hours, kilometres or cycles), then come back.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="pm-meter" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Meter</label>
        <select id="pm-meter" value={meterId ?? ''} onChange={(e) => onMeter(e.target.value ? Number(e.target.value) : undefined)} className={select}>
          <option value="">Choose a meter…</option>
          {meters.map((m) => <option key={m.id} value={m.id}>{m.name} ({number(m.reading)} {m.unit})</option>)}
        </select>
      </div>
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="pm-meter-every" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Every</label>
          <Input id="pm-meter-every" type="number" min={1} value={value} onChange={(e) => onValue(parseInt(e.target.value) || 1)} />
        </div>
        <p className="pb-2 text-sm text-gray-600 dark:text-gray-400">{meter?.unit ?? 'of the meter'}</p>
      </div>
      <div>
        <label htmlFor="pm-last-service" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Last serviced at (optional)</label>
        <Input id="pm-last-service" type="number" min={0} step="any" value={lastService} onChange={(e) => onLastService(e.target.value)}
          placeholder={meter ? number(meter.reading) : ''} className="w-40" />
        <p className="mt-1 text-xs text-gray-500">
          The meter's reading at the last service. Leave it empty to count from the reading now.
        </p>
      </div>
      {meter && base !== undefined && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300">
          Falls due when <b>{meter.name}</b> reaches <b>{number(base + value)} {meter.unit}</b>
          {base + value <= meter.reading ? ' (it is already past that, so a work order is made as soon as this is saved)' : ''}.
        </div>
      )}
    </div>
  )
}
