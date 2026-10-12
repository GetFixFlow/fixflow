import type { WorkOrderPart } from '@/types'

/** Cost of one parts line. The API sends unit_cost as a string because it is a decimal column. */
export function partLineTotal(part: Pick<WorkOrderPart, 'quantity_used' | 'unit_cost'>): number {
  return part.quantity_used * Number(part.unit_cost ?? 0)
}
