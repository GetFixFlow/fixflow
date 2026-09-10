import { cn } from '@/lib/utils'

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info' | 'warning'

const CONFIG: Record<Severity, { label: string; bg: string; text: string; dot: string }> = {
  critical: { label: 'Critical', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  high: { label: 'High', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  medium: { label: 'Medium', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  low: { label: 'Low', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-400' },
  info: { label: 'Info', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-700 dark:text-gray-300', dot: 'bg-gray-400' },
  warning: { label: 'High', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
}

interface AlertSeverityBadgeProps {
  severity: Severity
  size?: 'sm' | 'md'
  showDot?: boolean
}

export function AlertSeverityBadge({ severity, size = 'md', showDot = true }: AlertSeverityBadgeProps) {
  const c = CONFIG[severity] ?? CONFIG.info
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full font-semibold', c.bg, c.text,
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs uppercase tracking-wide')}>
      {showDot && <span className={cn('h-2 w-2 rounded-full shrink-0', c.dot)} />}
      {c.label}
    </span>
  )
}
