import type { PMChecklistStep, PMRequiredPart, PMTemplate } from '@/types'

/** What the schedule form sends as `template`: the work order each occurrence makes (the server reads nothing else). */
export function buildTemplate(form: {
  title: string
  fallbackTitle: string
  description?: string
  checklist: PMChecklistStep[]
  parts: PMRequiredPart[]
}): PMTemplate {
  return {
    title: form.title.trim() || form.fallbackTitle,
    description: form.description?.trim() || undefined,
    checklist: form.checklist.length > 0 ? form.checklist : undefined,
    required_parts: form.parts.length > 0 ? form.parts.map((p) => ({ part_id: p.part_id, quantity: p.quantity })) : undefined,
  }
}
