import type { Metric } from 'web-vitals'

export function reportWebVitals(onPerfEntry?: (metric: Metric) => void) {
  if (!onPerfEntry) return
  import('web-vitals').then(({ onCLS, onINP, onFCP, onLCP, onTTFB }) => {
    onCLS(onPerfEntry)
    onINP(onPerfEntry)
    onFCP(onPerfEntry)
    onLCP(onPerfEntry)
    onTTFB(onPerfEntry)
  })
}

export function logWebVitals() {
  reportWebVitals((metric) => {
    if (import.meta.env.DEV) {
      console.log(`[WebVitals] ${metric.name}:`, metric.value.toFixed(2))
    }
  })
}
