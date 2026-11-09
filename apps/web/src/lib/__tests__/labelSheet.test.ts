import { describe, it, expect, vi } from 'vitest'
import { barcodeModuleWidth, BARCODE_QUIET_ZONE, drawQrCodes, labelQrValue, labelQuery, LABEL_SIZES, PAPER, printStyles } from '../labelSheet'
import { code128Modules } from '../code128'

vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn(async (value: string) => `data:image/png;base64,${btoa(value)}`) } }))

describe('labelQrValue', () => {
  it('is the link to the request form for the asset, which is what the asset page shows too', () => {
    expect(labelQrValue({ public_code: 'abc123' }, 'https://fixflow.example.com')).toBe('https://fixflow.example.com/request?asset=abc123')
  })

  it('makes the code safe to put in a link', () => {
    expect(labelQrValue({ public_code: 'a b&c' }, 'https://x.test')).toBe('https://x.test/request?asset=a%20b%26c')
  })
})

describe('label sizes', () => {
  it('say what they are in millimetres, smallest first', () => {
    expect(Object.values(LABEL_SIZES).map((size) => [size.width, size.height])).toEqual([[60, 30], [80, 40], [100, 60]])
    expect(LABEL_SIZES.medium.label).toBe('Medium, 80 × 40 mm')
  })

  it('leave the narrowest bar of a barcode for a normal tag wide enough to print and to scan (0.2 mm), on every size', () => {
    const modules = code128Modules('FF-000001')!.length // the longest tag FixFlow makes
    for (const size of Object.values(LABEL_SIZES)) expect(barcodeModuleWidth(size, modules)).toBeGreaterThanOrEqual(0.2)
  })

  it('leave a clear space each side of a barcode of at least 6 bars, which a scanner needs to find where it starts', () => {
    const modules = code128Modules('FF-000001')!.length
    for (const size of Object.values(LABEL_SIZES)) expect(BARCODE_QUIET_ZONE).toBeGreaterThanOrEqual(6 * barcodeModuleWidth(size, modules))
  })

  it('work out the bar width from the label: wider labels, wider bars', () => {
    expect(barcodeModuleWidth(LABEL_SIZES.small, 112)).toBeCloseTo(0.21, 2)
    expect(barcodeModuleWidth(LABEL_SIZES.large, 112)).toBeGreaterThan(barcodeModuleWidth(LABEL_SIZES.small, 112))
  })
})

describe('printStyles', () => {
  const css = printStyles('sheet', 'a4')

  it('hides the sheet on the screen, and everything but the sheet when printing', () => {
    expect(css).toContain('#sheet { display: none; }')
    expect(css).toMatch(/@media print \{[\s\S]*body > \*:not\(#sheet\) \{ display: none !important; \}/)
  })

  it('shows the sheet as a flex box when printing, because its labels sit side by side', () => {
    expect(css).toContain('#sheet { display: flex !important; }')
  })

  it('takes away the margin the browser puts round the page, which only the first page would have', () => {
    expect(css).toMatch(/html, body \{ margin: 0 !important/)
  })

  it('sets the paper and a margin', () => {
    expect(css).toContain('@page { size: A4; margin: 8mm; }')
    expect(printStyles('sheet', 'letter')).toContain('@page { size: letter; margin: 8mm; }')
    expect(PAPER.letter.label).toBe('US Letter')
  })
})

describe('labelQuery', () => {
  it('carries the filters the list has chosen, and only those', () => {
    expect(labelQuery({ search: 'pump', status: 'down', location_id: 4 })).toBe('?search=pump&status=down&location_id=4')
    expect(labelQuery({ search: '', status: 'down', location_id: null })).toBe('?status=down')
    expect(labelQuery({ search: 'a b&c', status: '', location_id: null })).toBe('?search=a+b%26c')
  })

  it('is nothing when nothing is chosen', () => {
    expect(labelQuery({ search: '', status: '', location_id: null })).toBe('')
  })
})

describe('drawQrCodes', () => {
  it('draws a picture for each value, and reports as it goes, in chunks of 20', async () => {
    const values = Array.from({ length: 45 }, (_, i) => `https://x.test/request?asset=${i}`)
    const reports: number[] = []
    await drawQrCodes(values, (done) => reports.push(Object.keys(done).length))

    expect(reports).toEqual([20, 40, 45])
  })

  it('gives each value its own picture', async () => {
    let last: Record<string, string> = {}
    await drawQrCodes(['one', 'two'], (done) => { last = done })

    expect(last).toEqual({ one: `data:image/png;base64,${btoa('one')}`, two: `data:image/png;base64,${btoa('two')}` })
  })

  it('has nothing to report for nothing to draw', async () => {
    const onProgress = vi.fn()
    await drawQrCodes([], onProgress)

    expect(onProgress).not.toHaveBeenCalled()
  })
})
