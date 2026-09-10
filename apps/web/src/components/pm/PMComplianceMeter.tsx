import { cn } from '@/lib/utils'

interface PMComplianceMeterProps { rate: number; size?: 'sm' | 'md' | 'lg'; className?: string }

const SIZES = {
  sm: { outer: 'h-16 w-16', stroke: 28, text: 'text-xs' },
  md: { outer: 'h-24 w-24', stroke: 40, text: 'text-sm' },
  lg: { outer: 'h-32 w-32', stroke: 52, text: 'text-base' },
}

function colorForRate(rate: number): string {
  if (rate >= 90) return '#22c55e' // green-500
  if (rate >= 70) return '#eab308' // yellow-500
  return '#ef4444' // red-500
}

export function PMComplianceMeter({ rate, size = 'md', className }: PMComplianceMeterProps) {
  const { outer, stroke, text } = SIZES[size]
  const radius = stroke / 2 - 4
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (rate / 100) * circumference
  const color = colorForRate(rate)
  const cx = stroke / 2
  const cy = stroke / 2
  const label = size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-lg font-bold' : 'text-sm font-semibold'

  return (
    <div className={cn('relative inline-flex items-center justify-center', outer, className)} role="img" aria-label={`Compliance: ${rate}%`}>
      <svg viewBox={`0 0 ${stroke} ${stroke}`} className="absolute inset-0 h-full w-full -rotate-90" fill="none">
        <circle cx={cx} cy={cy} r={radius} stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx={cx} cy={cy} r={radius}
          stroke={color} strokeWidth="3"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <span className={cn('relative z-10 font-medium', label, text)} style={{ color }}>{rate}%</span>
    </div>
  )
}
