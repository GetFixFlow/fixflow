import { describe, it, expect } from 'vitest'
import { filtersFromStore, filtersSummary, rangeFor, scheduleSummary, storeDate } from '../savedReports'
import { applySavedReport } from '../applySavedReport'
import { useReportStore } from '@/stores/reportStore'
import { savedReport } from '@/test/savedReports'

const day = (text: string) => storeDate(text)

describe('rangeFor (the same dates as SavedReport.range_for on the server)', () => {
  it('means the whole days before today for the last N days', () => {
    const today = day('2026-11-04')

    expect(rangeFor('last_7_days', today)).toEqual({ from: '2026-10-28', to: '2026-11-03' })
    expect(rangeFor('last_30_days', today)).toEqual({ from: '2026-10-05', to: '2026-11-03' })
    expect(rangeFor('last_90_days', today)).toEqual({ from: '2026-08-06', to: '2026-11-03' })
  })

  it('means the month so far for this month, even on the 1st', () => {
    expect(rangeFor('this_month', day('2026-11-18'))).toEqual({ from: '2026-11-01', to: '2026-11-18' })
    expect(rangeFor('this_month', day('2026-11-01'))).toEqual({ from: '2026-11-01', to: '2026-11-01' })
  })

  it('means the whole month before for last month, across a year end and in a short month', () => {
    expect(rangeFor('last_month', day('2026-11-18'))).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(rangeFor('last_month', day('2027-01-05'))).toEqual({ from: '2026-12-01', to: '2026-12-31' })
    expect(rangeFor('last_month', day('2027-03-31'))).toEqual({ from: '2027-02-01', to: '2027-02-28' })
  })
})

describe('storeDate', () => {
  it('is midday, so the store reads back the same day whatever the time zone', () => {
    const date = storeDate('2026-11-04')

    expect(date.getHours()).toBe(12)
    expect(date.toISOString().slice(0, 10)).toBe('2026-11-04')
  })
})

describe('filtersSummary', () => {
  it('counts what is chosen, with the right plurals, and says when nothing is', () => {
    expect(filtersSummary({})).toBe('No filters')
    expect(filtersSummary({ location_ids: [1], asset_ids: [2, 3], priorities: ['high'], user_ids: [4, 5], sources: ['pm', 'iot'] }))
      .toBe('1 place, 2 assets, 2 people, 1 priority, 2 sources')
  })
})

describe('scheduleSummary', () => {
  const person = (id: number, full_name: string) => ({ id, full_name })

  it('says when and to whom, or that it is not emailed', () => {
    expect(scheduleSummary({ send_on: null, recipients: [] })).toBe('Not emailed')
    expect(scheduleSummary({ send_on: 1, recipients: [person(1, 'Mia Manager')] })).toBe('Mondays at 7:00, to Mia Manager')
    expect(scheduleSummary({ send_on: 0, recipients: [person(1, 'Mia'), person(2, 'Ana')] })).toBe('Sundays at 7:00, to Mia and Ana')
    expect(scheduleSummary({ send_on: 5, recipients: [person(1, 'Mia'), person(2, 'Ana'), person(3, 'Bo')] })).toBe('Fridays at 7:00, to Mia and 2 others')
  })
})

describe('filtersFromStore', () => {
  it('drops the empty lists', () => {
    expect(filtersFromStore({ location_ids: [], asset_ids: [4], user_ids: [], priorities: ['low'], sources: [] }))
      .toEqual({ asset_ids: [4], priorities: ['low'] })
  })
})

describe('applySavedReport', () => {
  it('replaces the filters and the dates in the Reports store with the saved report\'s', () => {
    useReportStore.setState({
      filters: { location_ids: [9], asset_ids: [9], user_ids: [9], priorities: ['low'], sources: ['iot'] },
    })

    applySavedReport(savedReport({ period: 'last_7_days', filters: { asset_ids: [4, 5], priorities: ['high'] } }), day('2026-11-04'))

    const { filters, getParams } = useReportStore.getState()
    expect(filters).toEqual({ location_ids: [], asset_ids: [4, 5], user_ids: [], priorities: ['high'], sources: [] })
    expect(getParams()).toMatchObject({ from: '2026-10-28', to: '2026-11-03', asset_ids: [4, 5], priorities: ['high'] })
    expect(getParams()).not.toHaveProperty('location_ids')
  })

  it('applies every kind of filter a saved report can hold', () => {
    const all = { location_ids: [1], asset_ids: [2], user_ids: [3], priorities: ['low'], sources: ['pm'] }

    applySavedReport(savedReport({ filters: all }), day('2026-11-04'))

    expect(useReportStore.getState().filters).toEqual(all)
  })
})
