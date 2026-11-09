import { barRuns, code128Modules } from '@/lib/code128'

interface Code128BarcodeProps {
  value: string
  /** Sizes are CSS lengths; the bars stretch to fill the width, whatever the number of characters. */
  height?: string
  className?: string
}

/** A Code 128 barcode of `value` as a vector drawing, sharp at any print size. Draws nothing for a value it cannot hold. */
export function Code128Barcode({ value, height = '8mm', className }: Code128BarcodeProps) {
  const modules = code128Modules(value)
  if (!modules) return null

  const bars = barRuns(modules).map(([start, length]) => `M${start} 0h${length}v1h-${length}z`).join('')
  return (
    <svg
      role="img"
      aria-label={`Barcode of ${value}`}
      viewBox={`0 0 ${modules.length} 1`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className={className}
      style={{ height, width: '100%' }}
    >
      <path d={bars} fill="#000" />
    </svg>
  )
}
