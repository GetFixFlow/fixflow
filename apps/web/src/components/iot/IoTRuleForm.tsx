import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAssets } from '@/hooks/useAssets'
import type { IoTOperator } from '@/types'

export interface IoTRuleFormData {
  asset_id?: number
  name: string
  metric_name: string
  metric_unit?: string
  operator: IoTOperator
  threshold_value: number
  threshold_min?: number
  threshold_max?: number
  sustained_minutes?: number
  auto_create_wo: boolean
  wo_priority?: string
  wo_assignee_id?: number
  wo_title_template?: string
  wo_description_template?: string
  cooldown_minutes?: number
}

interface IoTRuleFormProps {
  defaultValues?: Partial<IoTRuleFormData>
  onSubmit: (data: IoTRuleFormData) => Promise<void>
  isLoading?: boolean
  mode: 'create' | 'edit'
}

const OPERATORS = [
  { value: 'gt' as IoTOperator, label: '>', sublabel: 'Greater than' },
  { value: 'lt' as IoTOperator, label: '<', sublabel: 'Less than' },
  { value: 'gte' as IoTOperator, label: '≥', sublabel: 'Greater or equal' },
  { value: 'lte' as IoTOperator, label: '≤', sublabel: 'Less or equal' },
  { value: 'eq' as IoTOperator, label: '=', sublabel: 'Equals' },
  { value: 'outside_range' as IoTOperator, label: '↔', sublabel: 'Outside Range' },
]

const COMMON_METRICS = ['temperature', 'vibration', 'pressure', 'humidity', 'current', 'voltage', 'rpm']

const WO_PRIORITIES = ['low', 'medium', 'high', 'critical']

const STEPS = ['Asset', 'Metric', 'Trigger', 'Action', 'Review']

function formatPreview(data: Partial<IoTRuleFormData>, assetName?: string): string {
  if (!data.metric_name || !data.operator) return 'Complete the form to see preview'
  const opLabel = OPERATORS.find((o) => o.value === data.operator)?.label ?? data.operator
  if (data.operator === 'outside_range') {
    return `Trigger when ${data.metric_name} is not between ${data.threshold_min ?? '?'} and ${data.threshold_max ?? '?'} ${data.metric_unit ?? ''} on ${assetName ?? 'selected asset'}`
  }
  return `Trigger when ${data.metric_name} ${opLabel} ${data.threshold_value ?? '?'} ${data.metric_unit ?? ''} on ${assetName ?? 'selected asset'}`
}

export function IoTRuleForm({ defaultValues, onSubmit, isLoading, mode }: IoTRuleFormProps) {
  const [step, setStep] = useState(defaultValues?.asset_id ? 1 : 0)
  const [form, setForm] = useState<Partial<IoTRuleFormData>>({
    operator: 'gt',
    auto_create_wo: false,
    threshold_value: 0,
    cooldown_minutes: 60,
    ...defaultValues,
  })
  const [customMetric, setCustomMetric] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: assetsData } = useAssets()
  const assets = assetsData?.assets ?? []
  const selectedAsset = assets.find((a) => a.id === form.asset_id)

  const set = (updates: Partial<IoTRuleFormData>) =>
    setForm((prev) => ({ ...prev, ...updates }))

  const validateStep = (): boolean => {
    const errs: Record<string, string> = {}
    if (step === 0 && !form.asset_id) errs.asset_id = 'Select an asset'
    if (step === 1 && !form.metric_name) errs.metric_name = 'Select or enter a metric'
    if (step === 1 && !form.name) errs.name = 'Rule name is required'
    if (step === 2 && form.operator !== 'outside_range' && (form.threshold_value == null || isNaN(Number(form.threshold_value)))) {
      errs.threshold_value = 'Enter a threshold value'
    }
    if (step === 2 && form.operator === 'outside_range') {
      if (form.threshold_min == null) errs.threshold_min = 'Enter min value'
      if (form.threshold_max == null) errs.threshold_max = 'Enter max value'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => {
    if (!validateStep()) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const prev = () => setStep((s) => Math.max(s - 1, 0))

  const handleSubmit = async () => {
    if (!form.asset_id || !form.name || !form.metric_name || !form.operator) return
    const data: IoTRuleFormData = {
      asset_id: form.asset_id,
      name: form.name,
      metric_name: form.metric_name,
      metric_unit: form.metric_unit,
      operator: form.operator,
      threshold_value: form.threshold_value ?? 0,
      threshold_min: form.threshold_min,
      threshold_max: form.threshold_max,
      sustained_minutes: form.sustained_minutes,
      auto_create_wo: form.auto_create_wo ?? false,
      wo_priority: form.wo_priority,
      wo_title_template: form.wo_title_template,
      wo_description_template: form.wo_description_template,
      cooldown_minutes: form.cooldown_minutes,
    }
    await onSubmit(data)
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold border-2 transition-colors',
              i < step ? 'bg-brand-600 border-brand-600 text-white' :
              i === step ? 'border-brand-600 text-brand-600 bg-white dark:bg-gray-800' :
              'border-gray-300 text-gray-400 bg-white dark:bg-gray-800',
            )}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={cn('ml-2 text-xs font-medium hidden sm:block',
              i === step ? 'text-brand-600' : 'text-gray-400')}>{label}</span>
            {i < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 mx-2', i < step ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700')} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-6 space-y-4 min-h-[280px]">

        {/* Step 0: Asset */}
        {step === 0 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Step 1: Select Asset</h3>
            <p className="text-sm text-gray-500">Which asset do you want to monitor?</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Asset</label>
              <select
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                value={form.asset_id ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value)
                  set({ asset_id: id || undefined })
                  const asset = assets.find((a) => a.id === id)
                  if (asset && !form.name) {
                    set({ asset_id: id, name: `${asset.name} Alert` })
                  }
                }}
              >
                <option value="">Select an asset...</option>
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>{a.name} ({a.asset_tag})</option>
                ))}
              </select>
              {errors.asset_id && <p className="text-xs text-red-600 mt-1">{errors.asset_id}</p>}
            </div>
          </div>
        )}

        {/* Step 1: Metric */}
        {step === 1 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Step 2: What to Watch</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Rule Name</label>
              <Input
                value={form.name ?? ''}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="e.g. Pump-01 High Vibration"
                error={errors.name}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Metric</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {COMMON_METRICS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => set({ metric_name: m })}
                    className={cn(
                      'rounded-full px-3 py-1 text-xs font-medium border transition-colors capitalize',
                      form.metric_name === m
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'border-gray-300 text-gray-600 hover:border-brand-400 hover:text-brand-600 dark:border-gray-600 dark:text-gray-400',
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Or type custom metric..."
                  value={customMetric}
                  onChange={(e) => setCustomMetric(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customMetric.trim()) {
                      set({ metric_name: customMetric.trim() })
                      setCustomMetric('')
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { if (customMetric.trim()) { set({ metric_name: customMetric.trim() }); setCustomMetric('') } }}
                >
                  Add
                </Button>
              </div>
              {errors.metric_name && <p className="text-xs text-red-600 mt-1">{errors.metric_name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Unit (optional)</label>
              <Input
                value={form.metric_unit ?? ''}
                onChange={(e) => set({ metric_unit: e.target.value })}
                placeholder="e.g. °C, mm/s, bar"
              />
            </div>
          </div>
        )}

        {/* Step 2: Trigger */}
        {step === 2 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Step 3: When to Trigger</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Condition</label>
              <div className="grid grid-cols-3 gap-2">
                {OPERATORS.map((op) => (
                  <button
                    key={op.value}
                    type="button"
                    onClick={() => set({ operator: op.value })}
                    className={cn(
                      'rounded-lg border p-3 text-center transition-colors',
                      form.operator === op.value
                        ? 'border-brand-600 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-brand-400',
                    )}
                  >
                    <div className="text-xl font-bold text-gray-900 dark:text-gray-100">{op.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{op.sublabel}</div>
                  </button>
                ))}
              </div>
            </div>

            {form.operator === 'outside_range' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Min Value</label>
                  <Input
                    type="number"
                    value={form.threshold_min ?? ''}
                    onChange={(e) => set({ threshold_min: Number(e.target.value) })}
                    error={errors.threshold_min}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Max Value</label>
                  <Input
                    type="number"
                    value={form.threshold_max ?? ''}
                    onChange={(e) => set({ threshold_max: Number(e.target.value) })}
                    error={errors.threshold_max}
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  Threshold Value {form.metric_unit ? `(${form.metric_unit})` : ''}
                </label>
                <Input
                  type="number"
                  value={form.threshold_value ?? ''}
                  onChange={(e) => set({ threshold_value: Number(e.target.value) })}
                  error={errors.threshold_value}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Sustained for (minutes, optional)
              </label>
              <Input
                type="number"
                value={form.sustained_minutes ?? ''}
                onChange={(e) => set({ sustained_minutes: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0 = trigger immediately"
              />
            </div>

            {/* Live preview */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-3">
              <p className="text-xs font-medium text-gray-500 uppercase mb-1">Rule Preview</p>
              <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">
                {formatPreview(form, selectedAsset?.name)}
              </p>
            </div>
          </div>
        )}

        {/* Step 3: Action */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Step 4: What to Do</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Auto-create Work Order on trigger?
              </label>
              <div className="flex gap-3">
                {['Yes', 'No'].map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => set({ auto_create_wo: opt === 'Yes' })}
                    className={cn(
                      'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                      (opt === 'Yes') === form.auto_create_wo
                        ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                        : 'border-gray-300 text-gray-600 hover:border-brand-400 dark:border-gray-600 dark:text-gray-400',
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            {form.auto_create_wo && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">WO Priority</label>
                  <div className="flex gap-2">
                    {WO_PRIORITIES.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => set({ wo_priority: p })}
                        className={cn(
                          'flex-1 rounded-md border py-1.5 text-xs font-medium capitalize transition-colors',
                          form.wo_priority === p
                            ? 'border-brand-600 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
                            : 'border-gray-300 text-gray-600 hover:border-brand-400 dark:border-gray-600 dark:text-gray-400',
                        )}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    WO Title Template
                  </label>
                  <Input
                    value={form.wo_title_template ?? ''}
                    onChange={(e) => set({ wo_title_template: e.target.value })}
                    placeholder="e.g. High vibration on {{asset_name}}"
                  />
                  <p className="text-xs text-gray-400 mt-1">Variables: {'{{asset_name}}'}, {'{{metric}}'}, {'{{value}}'}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    WO Description Template
                  </label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-500"
                    rows={3}
                    value={form.wo_description_template ?? ''}
                    onChange={(e) => set({ wo_description_template: e.target.value })}
                    placeholder="Sensor reading {{value}} {{unit}} exceeded threshold {{threshold}} on {{asset_name}}"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                Cooldown (minutes)
              </label>
              <Input
                type="number"
                value={form.cooldown_minutes ?? ''}
                onChange={(e) => set({ cooldown_minutes: Number(e.target.value) })}
                placeholder="60"
              />
              <p className="text-xs text-gray-400 mt-1">Minimum time between repeated alerts for this rule</p>
            </div>
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && (
          <div className="space-y-4">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Step 5: Review</h3>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
              {[
                { label: 'Asset', value: selectedAsset ? `${selectedAsset.name} (${selectedAsset.asset_tag})` : `#${form.asset_id}` },
                { label: 'Rule Name', value: form.name },
                { label: 'Metric', value: `${form.metric_name} ${form.metric_unit ? `(${form.metric_unit})` : ''}` },
                { label: 'Condition', value: formatPreview(form, selectedAsset?.name) },
                { label: 'Sustained for', value: form.sustained_minutes ? `${form.sustained_minutes} min` : 'Immediate' },
                { label: 'Auto WO', value: form.auto_create_wo ? `Yes (${form.wo_priority ?? 'medium'} priority)` : 'No' },
                { label: 'Cooldown', value: `${form.cooldown_minutes ?? 60} min` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-start px-4 py-2.5 gap-4">
                  <span className="text-xs font-medium text-gray-500 w-28 shrink-0 pt-0.5">{label}</span>
                  <span className="text-sm text-gray-900 dark:text-gray-100">{value ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={prev} disabled={step === 0}>
          Back
        </Button>
        <span className="text-xs text-gray-400">Step {step + 1} of {STEPS.length}</span>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>Next</Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? 'Saving...' : mode === 'create' ? 'Create Rule' : 'Save Changes'}
          </Button>
        )}
      </div>
    </div>
  )
}
