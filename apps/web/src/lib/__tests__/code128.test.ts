import { describe, it, expect } from 'vitest'
import { barRuns, code128Modules } from '../code128'

// These module strings were decoded back to their text by an independent Code 128 reader (zxing-cpp), so a change that
// alters them has made a barcode that real scanners may not read.
const KNOWN = {
  'FF-000001': '1101001000010001100010100011000101001101110010111011110110110011001101100110011001101100101101110001100011101011',
  '5012345678900': '110100111001100010111010110011100100010110001110001011011000010100110111101101110101111010011101100100100011001100011101011',
  A: '1101001000010100011000100010110001100011101011',
}

describe('code128Modules', () => {
  it.each(Object.entries(KNOWN))('encodes %s as Code 128', (text, modules) => {
    expect(code128Modules(text)).toBe(modules)
  })

  it('starts with a start symbol and ends with the stop symbol and its bar', () => {
    const modules = code128Modules('SN-7788')!

    expect(modules).toMatch(/^(11010010000|11010011100)/)
    expect(modules.endsWith('1100011101011')).toBe(true)
  })

  it('uses the compact digit set for a run of digits, which is shorter', () => {
    expect(code128Modules('5012345678900')!.length).toBeLessThan(code128Modules('abcdefghijklm')!.length)
  })

  it('is a string of modules: bars and spaces only', () => {
    expect(code128Modules('Pump 3 / East')).toMatch(/^[01]+$/)
  })

  it('has nothing for an empty text or a character it cannot hold', () => {
    expect(code128Modules('')).toBeNull()
    expect(code128Modules('Pumpé')).toBeNull()
    expect(code128Modules('line\nbreak')).toBeNull()
    expect(code128Modules('日本')).toBeNull()
  })
})

describe('barRuns', () => {
  it('lists where each run of bars starts and how long it is', () => {
    expect(barRuns('11011')).toEqual([[0, 2], [3, 2]])
    expect(barRuns('0101110')).toEqual([[1, 1], [3, 3]])
    expect(barRuns('000')).toEqual([])
  })

  it('draws back exactly the modules it was given', () => {
    for (const modules of Object.values(KNOWN)) {
      const drawn = Array.from({ length: modules.length }, () => '0')
      for (const [start, length] of barRuns(modules)) for (let i = start; i < start + length; i++) drawn[i] = '1'

      expect(drawn.join('')).toBe(modules)
    }
  })
})
