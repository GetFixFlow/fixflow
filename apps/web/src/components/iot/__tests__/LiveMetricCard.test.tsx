import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LiveMetricCard } from '../LiveMetricCard'
import type { SensorReading } from '@/types'

function makeReading(value: number, minsAgo = 0): SensorReading {
  return { id: Math.random(), asset_id: 1, sensor_type: 'vibration', value, unit: 'mm/s', recorded_at: new Date(Date.now() - minsAgo * 60000).toISOString() }
}

describe('LiveMetricCard', () => {
  it('shows value and unit', () => {
    render(<LiveMetricCard metricName="vibration" unit="mm/s" readings={[makeReading(3.2)]} />)
    expect(screen.getByText('3.2')).toBeInTheDocument()
    expect(screen.getByText('mm/s')).toBeInTheDocument()
  })

  it('normal state shows green status', () => {
    render(<LiveMetricCard metricName="vibration" unit="mm/s" readings={[makeReading(3.2)]} threshold={8.5} operator="gt" />)
    expect(screen.getByText('✓ Normal')).toBeInTheDocument()
  })

  it('breached state shows red threshold indicator', () => {
    render(<LiveMetricCard metricName="vibration" unit="mm/s" readings={[makeReading(9.2)]} threshold={8.5} operator="gt" />)
    expect(screen.getByText(/threshold breached/i)).toBeInTheDocument()
  })

  it('stale state shown when reading is old', () => {
    render(<LiveMetricCard metricName="vibration" unit="mm/s" readings={[makeReading(3.2, 6)]} threshold={8.5} operator="gt" />)
    expect(screen.getByText(/no data|stale|5\+ min/i)).toBeInTheDocument()
  })

  it('shows progress bar % of threshold', () => {
    render(<LiveMetricCard metricName="vibration" unit="mm/s" readings={[makeReading(4.25)]} threshold={8.5} operator="gt" />)
    expect(screen.getByText('50% of limit')).toBeInTheDocument()
  })

  it('shows no threshold message when no rule set', () => {
    render(<LiveMetricCard metricName="vibration" unit="mm/s" readings={[makeReading(3.2)]} />)
    expect(screen.getByText('No threshold set')).toBeInTheDocument()
  })
})
