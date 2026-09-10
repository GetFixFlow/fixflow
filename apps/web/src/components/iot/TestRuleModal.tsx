import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useTestIotRule } from '@/hooks/useIoT'
import { cn } from '@/lib/utils'
import type { IotRuleExtended } from '@/types'

interface TestRuleModalProps {
  open: boolean
  rule: IotRuleExtended
  onClose: () => void
}

interface TestResult {
  would_trigger: boolean
  reason: string
  recent_readings: { value: number; unit: string; recorded_at: string; would_trigger: boolean }[]
}

export function TestRuleModal({ open, rule, onClose }: TestRuleModalProps) {
  const [testValue, setTestValue] = useState<string>(String(rule.threshold_value))
  const [result, setResult] = useState<TestResult | null>(null)
  const testRule = useTestIotRule()

  const handleTest = async () => {
    const value = parseFloat(testValue)
    if (isNaN(value)) return
    const res = await testRule.mutateAsync({ id: rule.id, value })
    setResult(res as TestResult)
  }

  const opLabel = { gt: '>', lt: '<', gte: '≥', lte: '≤', eq: '=', outside_range: 'not between' }[rule.operator] ?? rule.operator

  return (
    <Modal open={open} onClose={onClose} title="Test Rule" description={`Simulate a sensor reading for "${rule.name}"`}>
      <div className="space-y-4">
        {/* Rule summary */}
        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 p-3 space-y-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{rule.name}</p>
          <p className="text-xs text-gray-500">
            Trigger when <span className="font-mono font-medium text-gray-700 dark:text-gray-300">{rule.metric_name}</span>
            {' '}{opLabel}{' '}
            <span className="font-mono font-medium text-gray-700 dark:text-gray-300">
              {rule.operator === 'outside_range'
                ? `${rule.threshold_min} and ${rule.threshold_max}`
                : rule.threshold_value}
            </span>
            {' '}{rule.metric_unit ?? ''}
          </p>
        </div>

        {/* Test input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            Test Value {rule.metric_unit ? `(${rule.metric_unit})` : ''}
          </label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={testValue}
              onChange={(e) => { setTestValue(e.target.value); setResult(null) }}
              step="0.1"
            />
            <Button onClick={handleTest} disabled={testRule.isPending}>
              {testRule.isPending ? 'Testing...' : 'Run Test'}
            </Button>
          </div>
        </div>

        {/* Result */}
        {result && (
          <div className={cn(
            'rounded-lg border p-4 space-y-2',
            result.would_trigger
              ? 'border-red-300 bg-red-50 dark:border-red-700 dark:bg-red-900/20'
              : 'border-green-300 bg-green-50 dark:border-green-700 dark:bg-green-900/20',
          )}>
            <div className="flex items-center gap-2">
              <span className="text-lg">{result.would_trigger ? '🔴' : '✅'}</span>
              <p className={cn('text-sm font-semibold',
                result.would_trigger ? 'text-red-700 dark:text-red-300' : 'text-green-700 dark:text-green-300',
              )}>
                Would trigger: <span className="uppercase">{result.would_trigger ? 'YES' : 'NO'}</span>
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">{result.reason}</p>

            {result.recent_readings && result.recent_readings.length > 0 && (
              <div className="mt-3 space-y-1">
                <p className="text-xs font-medium text-gray-500 uppercase">Recent Readings</p>
                {result.recent_readings.slice(0, 5).map((r, i) => (
                  <div key={i} className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 py-0.5">
                    <span className="font-mono">{r.value} {r.unit}</span>
                    <span>{new Date(r.recorded_at).toLocaleTimeString()}</span>
                    <span className={r.would_trigger ? 'text-red-600' : 'text-green-600'}>
                      {r.would_trigger ? '⚡ trigger' : '✓ ok'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  )
}
