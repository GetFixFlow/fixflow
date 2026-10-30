import { describe, it, expect } from 'vitest'
import { phoneHref, websiteHref } from '../vendorLinks'

describe('websiteHref', () => {
  it('opens a web address as typed, or with https when the scheme was left off', () => {
    expect(websiteHref('https://acme.example/about')).toBe('https://acme.example/about')
    expect(websiteHref('http://acme.example')).toBe('http://acme.example/')
    expect(websiteHref('acme.example')).toBe('https://acme.example/')
    expect(websiteHref('acme.example:8080')).toBe('https://acme.example:8080/')
  })

  it('never makes a link of text that is another kind of address', () => {
    expect(websiteHref('javascript:alert(1)')).toBeNull()
    expect(websiteHref('JavaScript:alert(1)')).toBeNull()
    expect(websiteHref('data:text/html,<script>alert(1)</script>')).toBeNull()
    expect(websiteHref('mailto:a@b.example')).toBeNull()
    expect(websiteHref('ftp://acme.example')).toBeNull()
  })

  it('has no link for nothing or for text that is not an address', () => {
    expect(websiteHref(null)).toBeNull()
    expect(websiteHref('   ')).toBeNull()
    expect(websiteHref('not a site')).toBeNull()
  })
})

describe('phoneHref', () => {
  it('keeps the digits and a leading plus', () => {
    expect(phoneHref('+1 (555) 010-0100')).toBe('tel:+15550100100')
    expect(phoneHref('555-0100')).toBe('tel:5550100')
  })

  it('has no link when there are no digits', () => {
    expect(phoneHref('ask for Priya')).toBeNull()
    expect(phoneHref(null)).toBeNull()
  })
})
