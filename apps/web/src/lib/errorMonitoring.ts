export function initErrorMonitoring() {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[FixFlow] Unhandled promise rejection:', event.reason)
    // In production, you'd send to Sentry/Datadog here
  })
}

export function captureError(error: Error, context?: Record<string, unknown>) {
  if (import.meta.env.DEV) {
    console.error('[FixFlow] Error captured:', error, context)
  }
  // Sentry.captureException(error, { extra: context })
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (import.meta.env.DEV) {
    console.log(`[FixFlow] ${level.toUpperCase()}:`, message)
  }
}
