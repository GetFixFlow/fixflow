import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DowntimeChart } from '../DowntimeChart'
import type { DowntimeRow } from '@/types/reports'

const row = (id: number, downtime_hours: number): DowntimeRow => ({
  id, name: `Asset ${id}`, asset_tag: `FF-${id}`, location: null, availability: 100, downtime_hours, failures: 0, mtbf_hours: null,
  mttr_hours: null, down_now: false,
})

describe('DowntimeChart', () => {
  it('says so when no asset was down', () => {
    render(<DowntimeChart data={[row(1, 0), row(2, 0)]} />)

    expect(screen.getByText('No downtime in this period.')).toBeInTheDocument()
  })

  it('says so when there are no assets', () => {
    render(<DowntimeChart data={[]} />)

    expect(screen.getByText('No downtime in this period.')).toBeInTheDocument()
  })

  it('draws a chart when something was down', () => {
    render(<DowntimeChart data={[row(1, 0), row(2, 5)]} />)

    expect(screen.queryByText('No downtime in this period.')).toBeNull()
  })
})
