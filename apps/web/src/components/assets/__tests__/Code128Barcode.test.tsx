import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Code128Barcode } from '../Code128Barcode'
import { code128Modules } from '@/lib/code128'

describe('Code128Barcode', () => {
  it('draws one drawing for the value, as wide as the modules, named for a screen reader', () => {
    render(<Code128Barcode value="FF-000001" />)

    const drawing = screen.getByRole('img', { name: 'Barcode of FF-000001' })
    expect(drawing.getAttribute('viewBox')).toBe(`0 0 ${code128Modules('FF-000001')!.length} 1`)
    expect(drawing.querySelector('path')?.getAttribute('d')).toMatch(/^M0 0h2v1h-2z/) // the start symbol begins with a 2-module bar
  })

  it('stretches to the width it is given and takes the height asked for', () => {
    render(<Code128Barcode value="A" height="12mm" />)

    const style = screen.getByRole('img').getAttribute('style')
    expect(style).toContain('height: 12mm')
    expect(style).toContain('width: 100%')
  })

  it('draws nothing for a value it cannot hold', () => {
    const { container } = render(<Code128Barcode value="Pumpé" />)

    expect(container).toBeEmptyDOMElement()
  })
})
