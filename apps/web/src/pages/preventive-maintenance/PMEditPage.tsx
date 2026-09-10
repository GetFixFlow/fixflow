import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { format } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { AssetSelect } from '@/components/assets/AssetSelect'
import { ChecklistTemplateBuilder } from '@/components/pm/ChecklistTemplateBuilder'
import { RequiredPartsEditor } from '@/components/pm/RequiredPartsEditor'
import { usePM, useUpdatePM } from '@/hooks/usePreventiveMaintenance'
import { useAuthStore } from '@/stores/authStore'
import { cn } from '@/lib/utils'
import type { PMChecklistStep, PMRequiredPart, PmFrequencyType, PmFrequencyUnit, Priority } from '@/types'

const PRIORITY_OPTIONS: Priority[] = ['critical', 'high', 'medium', 'low']
const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'border-red-400 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-300',
  high: 'border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-600 dark:bg-orange-900/20 dark:text-orange-300',
  medium: 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300',
  low: 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
}

export function PMEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const pmId = Number(id)
  const isManager = user?.role === 'admin' || user?.role === 'manager'

  const { data, isLoading } = usePM(pmId)
  const pm = data?.data
  const updatePM = useUpdatePM(pmId)

  const [name, setName] = useState('')
  const [assetId, setAssetId] = useState<number | undefined>()
  const [priority, setPriority] = useState<Priority>('medium')
  const [description, setDescription] = useState('')
  const [freqType, setFreqType] = useState<PmFrequencyType>('time_based')
  const [freqValue, setFreqValue] = useState(30)
  const [freqUnit, setFreqUnit] = useState<PmFrequencyUnit>('days')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [estimatedHours, setEstimatedHours] = useState('')
  const [titleTemplate, setTitleTemplate] = useState('')
  const [checklistSteps, setChecklistSteps] = useState<PMChecklistStep[]>([])
  const [requiredParts, setRequiredParts] = useState<PMRequiredPart[]>([])
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    if (pm) {
      setName(pm.name ?? pm.title ?? '')
      setAssetId(pm.asset_id)
      setPriority(pm.priority ?? 'medium')
      setDescription(pm.description ?? '')
      setFreqType(pm.frequency_type ?? 'time_based')
      setFreqValue(pm.frequency_value ?? 30)
      setFreqUnit(pm.frequency_unit ?? 'days')
      setStartDate(pm.start_date ? format(new Date(pm.start_date), 'yyyy-MM-dd') : '')
      setEndDate(pm.end_date ? format(new Date(pm.end_date), 'yyyy-MM-dd') : '')
      setEstimatedHours(pm.estimated_hours?.toString() ?? '')
      setTitleTemplate(pm.title_template ?? '')
      setChecklistSteps(pm.checklist_template ?? [])
      setRequiredParts(pm.required_parts ?? [])
    }
  }, [pm])

  if (!isManager) return (
    <div className="text-center py-20 text-gray-500">You do not have permission to edit PM schedules.</div>
  )
  if (isLoading) return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
  if (!pm) return <div className="text-center py-20 text-gray-500">PM schedule not found</div>
  if (pm.status === 'archived') return (
    <div className="max-w-lg mx-auto text-center py-20">
      <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <p className="text-gray-500">Archived PM schedules cannot be edited.</p>
      <Link to={`/preventive-maintenance/${pm.id}`} className="mt-4 inline-block text-brand-600 hover:underline">Back to PM detail</Link>
    </div>
  )

  const handleSave = () => {
    updatePM.mutate({
      name,
      title: name,
      description,
      asset_id: assetId,
      priority,
      frequency_type: freqType,
      frequency_value: freqValue,
      frequency_unit: freqUnit,
      start_date: startDate,
      end_date: endDate || undefined,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      title_template: titleTemplate,
      checklist_template: checklistSteps.length > 0 ? checklistSteps : undefined,
      required_parts: requiredParts.length > 0 ? requiredParts.map((p) => ({ part_id: p.part_id, quantity: p.quantity })) : undefined,
    }, { onSuccess: () => navigate(`/preventive-maintenance/${pm.id}`) })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to={`/preventive-maintenance/${pm.id}`} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit PM Schedule</h1>
      </div>

      <div className="rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-3 flex gap-2 text-sm">
        <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
        <p className="text-yellow-700 dark:text-yellow-300">Changing the frequency will recalculate the next due date from today.</p>
      </div>

      <Card>
        <CardContent className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PM Schedule Name*</label>
            <Input value={name} onChange={(e) => { setName(e.target.value); setIsDirty(true) }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset*</label>
            <AssetSelect value={assetId} onChange={(v) => { setAssetId(v ?? undefined); setIsDirty(true) }} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority</label>
            <div className="flex gap-2 flex-wrap">
              {PRIORITY_OPTIONS.map((p) => (
                <button key={p} type="button" onClick={() => { setPriority(p); setIsDirty(true) }}
                  className={cn('rounded-md border px-3 py-1.5 text-sm font-medium capitalize', priority === p ? PRIORITY_COLORS[p] : 'border-gray-200 text-gray-500 dark:border-gray-700')}>
                  {p}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={description} onChange={(e) => { setDescription(e.target.value); setIsDirty(true) }} rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency: Every</label>
              <Input type="number" min={1} value={freqValue} onChange={(e) => { setFreqValue(parseInt(e.target.value) || 1); setIsDirty(true) }} />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
              <select value={freqUnit} onChange={(e) => { setFreqUnit(e.target.value as PmFrequencyUnit); setIsDirty(true) }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                {['days','weeks','months','hours','cycles'].map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title Template</label>
            <Input value={titleTemplate} onChange={(e) => { setTitleTemplate(e.target.value); setIsDirty(true) }} placeholder={name} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Estimated Hours</label>
            <Input type="number" min={0} step={0.5} value={estimatedHours} onChange={(e) => { setEstimatedHours(e.target.value); setIsDirty(true) }} className="w-32" />
          </div>
          <ChecklistTemplateBuilder value={checklistSteps} onChange={(v) => { setChecklistSteps(v); setIsDirty(true) }} />
          <RequiredPartsEditor value={requiredParts} onChange={(v) => { setRequiredParts(v); setIsDirty(true) }} />
        </CardContent>
      </Card>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => navigate(`/preventive-maintenance/${pm.id}`)}>Cancel</Button>
        <Button onClick={handleSave} disabled={!isDirty} loading={updatePM.isPending}>Save Changes</Button>
      </div>
    </div>
  )
}
