import { describe, it, expect, beforeEach } from 'vitest'
import {
  DEFAULT_LOCALE, formatDate, formatDateTime, formatMoney, formatNumber, formatShortMoney, formatTime,
  formattersFor, useLocaleStore, weekdayLabels, weekStartsOn,
} from '../localeFormat'

const set = (changes: Partial<typeof DEFAULT_LOCALE>) => useLocaleStore.getState().setLocale(changes)
const moment = new Date(2026, 9, 5, 15, 30) // 5 October 2026, 15:30 local

beforeEach(() => {
  localStorage.clear()
  useLocaleStore.setState({ locale: DEFAULT_LOCALE })
})

describe('dates and times', () => {
  it('shows each of the date styles on offer', () => {
    const shown = ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD', 'DD MMM YYYY', 'MMM D, YYYY'].map((date_format) => {
      set({ date_format })
      return formatDate(moment)
    })

    expect(shown).toEqual(['10/05/2026', '05/10/2026', '2026-10-05', '05 Oct 2026', 'Oct 5, 2026'])
  })

  it('shows time in 12 or 24 hours', () => {
    expect(formatTime(moment)).toBe('3:30 PM')
    set({ time_format: '24h' })
    expect(formatTime(moment)).toBe('15:30')
  })

  it('puts date and time together as each is set', () => {
    set({ date_format: 'DD/MM/YYYY', time_format: '24h' })
    expect(formatDateTime(moment)).toBe('05/10/2026 15:30')
  })

  it('reads a bare date as that calendar day, not the day before in a western time zone', () => {
    expect(formatDate('2026-10-05')).toBe('Oct 5, 2026')
  })

  it('accepts dates as text, numbers and Dates', () => {
    expect(formatDate(moment.toISOString())).toBe('Oct 5, 2026')
    expect(formatDate(moment.getTime())).toBe('Oct 5, 2026')
  })

  it('shows a dash for nothing, and for what is not a date', () => {
    expect([formatDate(null), formatDate(undefined), formatDate(''), formatDate('not a date'), formatDateTime(null), formatTime(null)]).toEqual(Array(6).fill('—'))
  })

  it('falls back to the usual style for a value it does not know', () => {
    set({ date_format: 'YYYY/DD/MM' })
    expect(formatDate(moment)).toBe('Oct 5, 2026')
  })
})

describe('numbers and money', () => {
  it('uses each separator style', () => {
    const shown = ['1,234.56', '1.234,56', '1 234.56', '1 234,56'].map((number_format) => {
      set({ number_format })
      return formatNumber(1234567.891, 2)
    })

    expect(shown).toEqual(['1,234,567.89', '1.234.567,89', '1 234 567.89', '1 234 567,89'])
  })

  it('does not break small numbers or negatives', () => {
    expect([formatNumber(0), formatNumber(999), formatNumber(1000), formatNumber(-1234.5, 1)]).toEqual(['0', '999', '1,000', '-1,234.5'])
  })

  it('does not show a minus sign for something that rounds to zero', () => {
    expect(formatNumber(-0.001, 2)).toBe('0.00')
  })

  it('shows money in the company currency, with its usual decimals', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50')
    set({ currency: 'EUR', number_format: '1.234,56' })
    expect(formatMoney(1234.5)).toBe('€1.234,50')
    set({ currency: 'JPY', number_format: '1,234.56' })
    expect(formatMoney(1234.5)).toBe('¥1,235')
    set({ currency: 'LKR' })
    expect(formatMoney(1234.5)).toBe('Rs 1,234.50')
  })

  it('takes amounts that arrive as text, as the server sends costs', () => {
    expect(formatMoney('12.5')).toBe('$12.50')
  })

  it('shows a dash for no amount, and keeps the sign of a negative one', () => {
    expect([formatMoney(null), formatMoney(undefined), formatMoney(''), formatMoney('abc')]).toEqual(Array(4).fill('—'))
    expect(formatMoney(-5)).toBe('-$5.00')
  })

  it('can show whole amounts, as charts do', () => {
    expect(formatMoney(1234.56, 0)).toBe('$1,235')
  })

  it('shows compact amounts for chart axes', () => {
    expect([formatShortMoney(950), formatShortMoney(1200, 1), formatShortMoney(15000, 0)]).toEqual(['$950', '$1.2k', '$15k'])
    set({ currency: 'EUR', number_format: '1.234,56' })
    expect(formatShortMoney(1200, 1)).toBe('€1,2k')
  })
})

describe('the first day of the week', () => {
  it('is Sunday unless set, as the calendars always were', () => {
    expect(weekStartsOn()).toBe(0)
    expect(weekdayLabels()).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  })

  it('can be Monday, with the calendar headings to match', () => {
    set({ first_day_of_week: 'monday' })
    expect(weekStartsOn()).toBe(1)
    expect(weekdayLabels()).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
  })
})

describe('the settings in use', () => {
  it('are remembered for the next time the app opens', () => {
    set({ currency: 'GBP' })
    expect(JSON.parse(localStorage.getItem('fixflow-locale')!)).toMatchObject({ currency: 'GBP' })
  })

  it('can be tried out without changing what the app shows', () => {
    const preview = formattersFor({ ...DEFAULT_LOCALE, currency: 'EUR', date_format: 'YYYY-MM-DD' })

    expect(preview.money(5)).toBe('€5.00')
    expect(preview.date(moment)).toBe('2026-10-05')
    expect(formatMoney(5)).toBe('$5.00')
  })
})
