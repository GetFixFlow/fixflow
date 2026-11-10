import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import i18n, { initialLanguage, setLanguage } from '@/i18n'
import { LanguageApplier } from '@/components/layout/LanguageApplier'
import { LanguageSelect } from '@/components/ui/LanguageSelect'
import { useAuthStore } from '@/stores/authStore'
import { formattersFor, weekdayLabels, DEFAULT_LOCALE } from '@/lib/localeFormat'
import type { User } from '@/types'

const person = (language?: string) => ({ id: 1, email: 'a@b.test', full_name: 'Ana Ruiz', role: 'technician', organization_id: 1, language }) as User

afterEach(() => {
  act(() => useAuthStore.setState({ user: null, token: null, isAuthenticated: false }))
  localStorage.clear()
})

describe('LanguageApplier', () => {
  it('switches the screens to the signed-in person\'s language, and does not keep it on the device', () => {
    render(<LanguageApplier />)
    act(() => useAuthStore.setState({ user: person('es') }))

    expect(i18n.language).toBe('es')
    expect(document.documentElement.lang).toBe('es')
    expect(localStorage.getItem('fixflow-language')).toBeNull()
  })

  it('ignores a language the app does not have', () => {
    render(<LanguageApplier />)
    act(() => useAuthStore.setState({ user: person('xx') }))

    expect(i18n.language).toBe('en')
  })
})

describe('LanguageSelect', () => {
  it('offers each language by its own name and switches, remembering the choice on this device', async () => {
    render(<LanguageSelect />)
    const select = screen.getByRole('combobox', { name: 'Language' })

    expect(Array.from(select.querySelectorAll('option')).map((o) => o.textContent)).toEqual(['English', 'Español'])
    await userEvent.selectOptions(select, 'es')

    expect(i18n.language).toBe('es')
    expect(localStorage.getItem('fixflow-language')).toBe('es')
    expect(screen.getByRole('combobox', { name: 'Idioma' })).toHaveValue('es')
  })
})

describe('the language a visitor starts in', () => {
  it('is the one chosen before on this device', () => {
    localStorage.setItem('fixflow-language', 'es')
    expect(initialLanguage()).toBe('es')
  })

  it('is the browser\'s when it is one we have, else English', () => {
    const languages = vi.spyOn(navigator, 'languages', 'get')
    languages.mockReturnValue(['fr-FR', 'es-MX'])
    expect(initialLanguage()).toBe('es')
    languages.mockReturnValue(['fr-FR'])
    expect(initialLanguage()).toBe('en')
    languages.mockRestore()
  })
})

describe('dates in another language', () => {
  const sample = new Date(2026, 10, 3, 15, 30)

  it('use the month names and AM/PM of the language, with the company\'s format', () => {
    setLanguage('es', false)
    expect(formattersFor({ ...DEFAULT_LOCALE, date_format: 'DD MMM YYYY' }).date(sample)).toBe('03 nov 2026')
    expect(formattersFor(DEFAULT_LOCALE).date(sample)).toBe('nov 3, 2026')
    expect(formattersFor(DEFAULT_LOCALE).time(sample)).toMatch(/^3:30 p\.\s?m\.$/)
    expect(formattersFor({ ...DEFAULT_LOCALE, time_format: '24h' }).time(sample)).toBe('15:30')
    expect(formattersFor({ ...DEFAULT_LOCALE, date_format: 'YYYY-MM-DD' }).date(sample)).toBe('2026-11-03')
  })

  it('give the weekday names of the language, from the company\'s first day', () => {
    setLanguage('es', false)
    expect(weekdayLabels()[0]).toMatch(/^dom/i)
  })

  it('stay English in English', () => {
    expect(formattersFor({ ...DEFAULT_LOCALE, date_format: 'DD MMM YYYY' }).date(sample)).toBe('03 Nov 2026')
    expect(formattersFor(DEFAULT_LOCALE).time(sample)).toBe('3:30 PM')
  })
})
