/**
 * A website the way a person typed it ("acme.example", "https://acme.example") as an address to open, or null when it is
 * not a web address. Only http and https are linked: the text is free, and a "javascript:" link must never be made of it.
 */
export function websiteHref(website: string | null | undefined): string | null {
  const text = (website ?? '').trim()
  if (!text) return null
  // "acme.example:8080" is a host and a port; "javascript:..." or "mailto:..." is a scheme, which is not linked.
  const otherScheme = /^[a-z][a-z0-9+.-]*:(?!\d)/i.test(text) && !/^https?:/i.test(text)
  if (otherScheme) return null
  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`)
    return url.href
  } catch {
    return null
  }
}

/** A phone number as a tel: link (digits and a leading + only), or null when it has no digits. */
export function phoneHref(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/[^\d+]/g, '')
  return /\d/.test(digits) ? `tel:${digits}` : null
}
