import { describe, it, expect, beforeEach } from 'vitest'
import { applyBrandColor, brandRamp, contrastWithWhite, DEFAULT_PRIMARY, hexToRgb, isHexColor, restoreBrandColor } from '../brandColors'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('style')
})

const brand = (step: number) => document.documentElement.style.getPropertyValue(`--brand-${step}`)

describe('brandColors', () => {
  it('reads hex colours and nothing else', () => {
    expect(hexToRgb('#2563eb')).toEqual([37, 99, 235])
    expect(isHexColor('#16A34A')).toBe(true)
    expect(['blue', '#fff', '#12345', '2563eb', ''].map(isHexColor)).toEqual([false, false, false, false, false])
  })

  it('measures contrast against white the way the server does', () => {
    expect(contrastWithWhite('#000000')).toBeCloseTo(21, 0)
    expect(contrastWithWhite('#ffffff')).toBeCloseTo(1, 1)
    expect(contrastWithWhite('#2563eb')).toBeGreaterThan(5)
    expect(contrastWithWhite('#ffeb3b')).toBeLessThan(3)
  })

  it('builds shades from light to dark around the chosen colour, which is shade 600', () => {
    const ramp = brandRamp('#16a34a')!

    expect(ramp[600]).toBe('22 163 74')
    const sum = (step: number) => ramp[step].split(' ').map(Number).reduce((a, b) => a + b)
    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map(sum)
    expect(steps).toEqual([...steps].sort((a, b) => b - a)) // each darker than the one before
  })

  it('restyles the app around a colour', () => {
    applyBrandColor('#16a34a')

    expect(brand(600)).toBe('22 163 74')
    expect(brand(50)).not.toBe('')
  })

  it('leaves the shipped blue alone for the default colour, and puts it back after another', () => {
    applyBrandColor('#16a34a')
    applyBrandColor(DEFAULT_PRIMARY)

    expect(brand(600)).toBe('') // falls back to the stylesheet's values
    expect(localStorage.getItem('fixflow-brand-color')).toBeNull()
  })

  it('remembers the colour so the next page load does not flash blue first', () => {
    applyBrandColor('#7c3aed')
    document.documentElement.removeAttribute('style')

    restoreBrandColor()

    expect(brand(600)).toBe('124 58 237')
  })

  it('ignores a remembered value that is not a colour', () => {
    localStorage.setItem('fixflow-brand-color', 'javascript:alert(1)')
    restoreBrandColor()

    expect(brand(600)).toBe('')
  })
})
