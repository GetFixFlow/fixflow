// Custom Recharts tooltip matching FixFlow design

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ name: string; value: number; color?: string }>
  label?: string
  formatter?: (name: string, value: number) => string
}

export function ChartTooltip({ active, payload, label, formatter }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg bg-gray-900 text-white shadow-xl px-3 py-2 text-xs border border-gray-700">
      {label && <p className="font-medium mb-1.5 text-gray-200">{label}</p>}
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: p.color ?? '#6b7280' }} />
          <span className="text-gray-300">{p.name}:</span>
          <span className="font-semibold">{formatter ? formatter(p.name, p.value) : p.value}</span>
        </div>
      ))}
    </div>
  )
}
