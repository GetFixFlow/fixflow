import { describe, expect, it } from 'vitest'
import { escapeHtml } from '../utils'

describe('escapeHtml', () => {
  it('turns every character that could start markup or end an attribute into text', () => {
    expect(escapeHtml(`<img src="x" onerror='y'> & more`)).toBe('&lt;img src=&quot;x&quot; onerror=&#39;y&#39;&gt; &amp; more')
  })

  it('leaves ordinary text, including other scripts and symbols, as it is', () => {
    expect(escapeHtml('Pump 3 · Café · ஆலை')).toBe('Pump 3 · Café · ஆலை')
  })

  it('does not escape twice what it escaped', () => {
    expect(escapeHtml(escapeHtml('<b>'))).toBe('&amp;lt;b&amp;gt;')
  })
})
