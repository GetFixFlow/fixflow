import { useState, useMemo } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { format, addDays, addWeeks, addMonths } from 'date-fns'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent } from '@/components/ui/Card'
import { AssetSelect } from '@/components/assets/AssetSelect'
import { AssetMiniCard } from '@/components/assets/AssetMiniCard'
import { ChecklistTemplateBuilder } from '@/components/pm/ChecklistTemplateBuilder'
import { RequiredPartsEditor } from '@/components/pm/RequiredPartsEditor'
import { PMFrequencyBadge } from '@/components/pm/PMFrequencyBadge'
import { useCreatePM } from '@/hooks/usePreventiveMaintenance'
import { useAsset } from '@/hooks/useAssets'
import { cn } from '@/lib/utils'
import type { PMChecklistStep, PMRequiredPart, PmFrequencyType, PmFrequencyUnit, Priority } from '@/types'

const STEPS = ['Basic', 'Schedule', 'Template', 'Review']
const PRIORITY_OPTIONS: Priority[] = ['critical', 'high', 'medium', 'low']
const PRIORITY_COLORS: Record<Priority, string> = {
  critical: 'border-red-400 bg-red-50 text-red-700 dark:border-red-600 dark:bg-red-900/20 dark:text-red-300',
  high: 'border-orange-400 bg-orange-50 text-orange-700 dark:border-orange-600 dark:bg-orange-900/20 dark:text-orange-300',
  medium: 'border-yellow-400 bg-yellow-50 text-yellow-700 dark:border-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-300',
  low: 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
}

// Client-side schedule preview
function computePreviewDates(
  freqType: PmFrequencyType,
  freqValue: number,
  freqUnit: PmFrequencyUnit,
  startDate: string,
  count = 5,
): Date[] {
  const start = startDate ? new Date(startDate) : new Date()
  const dates: Date[] = [new Date(start)]
  for (let i = 1; i < count; i++) {
    let next = new Date(dates[i - 1])
    if (freqType === 'time_based') {
      if (freqUnit === 'days') next = addDays(next, freqValue)
      else if (freqUnit === 'weeks') next = addWeeks(next, freqValue)
      else next = addMonths(next, freqValue)
    } else {
      next = addDays(next, freqValue * 30) // meter-based: approx
    }
    dates.push(next)
  }
  return dates
}

export function PMCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lockedAssetId = searchParams.get('asset_id') ? Number(searchParams.get('asset_id')) : undefined

  const [step, setStep] = useState(0)
  const createPM = useCreatePM()

  // Step 1 state
  const [name, setName] = useState('')
  const [assetId, setAssetId] = useState<number | undefined>(lockedAssetId)
  const [priority, setPriority] = useState<Priority>('medium')
  const [description, setDescription] = useState('')

  // Step 2 state
  const [freqType, setFreqType] = useState<PmFrequencyType>('time_based')
  const [freqValue, setFreqValue] = useState(30)
  const [freqUnit, setFreqUnit] = useState<PmFrequencyUnit>('days')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState('')
  const [noEndDate, setNoEndDate] = useState(true)
  const [estimatedHours, setEstimatedHours] = useState('')

  // Step 3 state
  const [titleTemplate, setTitleTemplate] = useState('')
  const [descTemplate, setDescTemplate] = useState('')
  const [checklistSteps, setChecklistSteps] = useState<PMChecklistStep[]>([])
  const [requiredParts, setRequiredParts] = useState<PMRequiredPart[]>([])

  const { data: asset } = useAsset(assetId ?? 0)

  const previewDates = useMemo(
    () => computePreviewDates(freqType, freqValue, freqUnit, startDate),
    [freqType, freqValue, freqUnit, startDate],
  )

  const step1Valid = name.trim().length >= 3 && !!assetId
  const step2Valid = freqValue > 0 && !!startDate

  const handleSubmit = () => {
    const payload: Record<string, unknown> = {
      name,
      title: name,
      description,
      asset_id: assetId,
      priority,
      frequency_type: freqType,
      frequency_value: freqValue,
      frequency_unit: freqUnit,
      start_date: startDate,
      end_date: noEndDate ? undefined : endDate || undefined,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
      title_template: titleTemplate || name,
      description_template: descTemplate,
      checklist_template: checklistSteps.length > 0 ? checklistSteps : undefined,
      required_parts: requiredParts.length > 0 ? requiredParts.map((p) => ({ part_id: p.part_id, quantity: p.quantity })) : undefined,
    }
    createPM.mutate(payload, {
      onSuccess: (res) => navigate(`/preventive-maintenance/${res.data.data.id}`),
    })
  }

  const FREQ_TYPE_CARDS: { id: PmFrequencyType; label: string; icon: string; desc: string }[] = [
    { id: 'time_based', label: 'Time-Based', icon: '⏱', desc: 'Every N days/weeks/months' },
    { id: 'meter_based', label: 'Meter-Based', icon: '📊', desc: 'Every N hours/cycles' },
    { id: 'calendar_based', label: 'Calendar', icon: '📅', desc: 'Specific day of month/week' },
    { id: 'condition_based', label: 'Condition', icon: '⚡', desc: 'Triggered by IoT rule' },
  ]

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link to="/preventive-maintenance" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New PM Schedule</h1>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
              i < step ? 'bg-green-500 text-white' : i === step ? 'bg-brand-600 text-white' : 'bg-gray-200 text-gray-500 dark:bg-gray-700')}>
              {i < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span className={cn('text-sm', i === step ? 'font-medium text-gray-900 dark:text-gray-100' : 'text-gray-400')}>{s}</span>
            {i < STEPS.length - 1 && <span className="text-gray-300 mx-1">─</span>}
          </div>
        ))}
      </div>

      <Card>
        <CardContent className="p-6">
          {/* STEP 1 */}
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Basic Information</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PM Schedule Name*</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Monthly Pump Oil Change" />
                <p className="text-xs text-gray-400 mt-1">This will appear in generated work order titles</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Asset*</label>
                <AssetSelect value={assetId} onChange={(v) => setAssetId(v ?? undefined)} disabled={!!lockedAssetId} />
                {asset && <div className="mt-2"><AssetMiniCard asset={asset} /></div>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Priority*</label>
                <div className="flex gap-2 flex-wrap">
                  {PRIORITY_OPTIONS.map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)}
                      className={cn('rounded-md border px-3 py-1.5 text-sm font-medium capitalize transition-all', priority === p ? PRIORITY_COLORS[p] : 'border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700')}>
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
            </div>
          )}

          {/* STEP 2 */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Schedule & Frequency</h2>
              <div className="grid grid-cols-2 gap-3">
                {FREQ_TYPE_CARDS.map((ft) => (
                  <button key={ft.id} type="button" onClick={() => setFreqType(ft.id)}
                    className={cn('rounded-lg border p-3 text-left transition-all', freqType === ft.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300')}>
                    <div className="text-xl mb-1">{ft.icon}</div>
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{ft.label}</div>
                    <div className="text-xs text-gray-500">{ft.desc}</div>
                  </button>
                ))}
              </div>

              {(freqType === 'time_based' || freqType === 'meter_based') && (
                <div className="flex gap-3 items-end">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Every</label>
                    <Input type="number" min={1} value={freqValue} onChange={(e) => setFreqValue(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="flex-1">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Unit</label>
                    <select value={freqUnit} onChange={(e) => setFreqUnit(e.target.value as PmFrequencyUnit)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                      {freqType === 'time_based'
                        ? ['days','weeks','months'].map((u) => <option key={u} value={u}>{u}</option>)
                        : ['hours','cycles','km'].map((u) => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Start Date*</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">End Date</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={noEndDate} />
                  <label className="flex items-center gap-1.5 mt-1 text-xs cursor-pointer">
                    <input type="checkbox" checked={noEndDate} onChange={(e) => setNoEndDate(e.target.checked)} />No end date
                  </label>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Estimated Hours</label>
                <Input type="number" min={0} step={0.5} value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} placeholder="e.g. 1.5" className="w-32" />
              </div>

              {/* Schedule preview */}
              <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 p-3">
                <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">📅 Schedule Preview</p>
                <ol className="space-y-1">
                  {previewDates.map((d, i) => {
                    const diff = Math.round((d.getTime() - Date.now()) / 86400000)
                    return (
                      <li key={i} className="flex gap-2 text-sm">
                        <span className="text-blue-600 dark:text-blue-400 w-4">{i + 1}.</span>
                        <span className="text-gray-700 dark:text-gray-300">{format(d, 'MMM d, yyyy')}</span>
                        <span className="text-gray-400 text-xs">(in {diff} days)</span>
                        {i === 0 && <span className="text-xs text-blue-500">← first</span>}
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Work Order Template</h2>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Title Template*</label>
                <Input value={titleTemplate || name} onChange={(e) => setTitleTemplate(e.target.value)}
                  placeholder={`{asset_name} - ${name || 'PM Schedule'}`} />
                <div className="flex gap-1 mt-1 flex-wrap">
                  {['{asset_name}', '{asset_tag}', '{location}', '{frequency}'].map((v) => (
                    <button key={v} type="button" onClick={() => setTitleTemplate((t) => (t || name) + ' ' + v)}
                      className="rounded bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-200">
                      {v}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Preview: <span className="font-mono">{(titleTemplate || name).replace('{asset_name}', asset?.name ?? '[asset]').replace('{asset_tag}', asset?.asset_tag ?? '[tag]')}</span>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Description Template</label>
                <textarea value={descTemplate} onChange={(e) => setDescTemplate(e.target.value)} rows={3}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none" />
              </div>
              <ChecklistTemplateBuilder value={checklistSteps} onChange={setChecklistSteps} />
              <RequiredPartsEditor value={requiredParts} onChange={setRequiredParts} />
            </div>
          )}

          {/* STEP 4 — Review */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Review & Create</h2>
              <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4 space-y-3 text-sm">
                <p className="font-semibold text-gray-900 dark:text-gray-100 text-base">📋 {name}</p>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-gray-500">Asset</dt><dd>{asset?.name} ({asset?.asset_tag})</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Priority</dt><dd className="capitalize">{priority}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Schedule</dt>
                    <dd><PMFrequencyBadge frequencyType={freqType} frequencyValue={freqValue} frequencyUnit={freqUnit} /></dd>
                  </div>
                  <div className="flex justify-between"><dt className="text-gray-500">Starts</dt><dd>{format(new Date(startDate), 'MMM d, yyyy')}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">First due</dt><dd>{format(previewDates[0], 'MMM d, yyyy')}</dd></div>
                  <div className="flex justify-between"><dt className="text-gray-500">Template</dt><dd className="truncate max-w-[60%]">{titleTemplate || name}</dd></div>
                  {checklistSteps.length > 0 && <div className="flex justify-between"><dt className="text-gray-500">Checklist</dt><dd>{checklistSteps.length} steps ({checklistSteps.filter((s) => s.required).length} required)</dd></div>}
                  {requiredParts.length > 0 && <div className="flex justify-between"><dt className="text-gray-500">Parts</dt><dd>{requiredParts.map((p) => `${p.part?.name} ×${p.quantity}`).join(', ')}</dd></div>}
                  {estimatedHours && <div className="flex justify-between"><dt className="text-gray-500">Est. Hours</dt><dd>{estimatedHours} hrs / occurrence</dd></div>}
                </dl>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => step === 0 ? navigate('/preventive-maintenance') : setStep(step - 1)}>
          {step === 0 ? 'Cancel' : '← Back'}
        </Button>
        {step < 3 ? (
          <Button onClick={() => setStep(step + 1)} disabled={(step === 0 && !step1Valid) || (step === 1 && !step2Valid)}>
            Next <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} loading={createPM.isPending}>
            Create PM Schedule
          </Button>
        )}
      </div>
    </div>
  )
}
