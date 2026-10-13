import { useEffect } from 'react'
import { useBranding } from '@/hooks/useSettings'
import { applyBrandColor } from '@/lib/brandColors'

/** Puts the company's colour and favicon on the whole app, including the sign-in page. Renders nothing. */
export function BrandingApplier() {
  const { data } = useBranding()
  const color = data?.primary_color
  const favicon = data?.favicon_url

  useEffect(() => {
    if (color) applyBrandColor(color)
  }, [color])

  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
    if (!link) return
    const original = link.dataset.original ?? link.getAttribute('href') ?? ''
    link.dataset.original = original
    link.setAttribute('href', favicon || original)
  }, [favicon])

  return null
}
