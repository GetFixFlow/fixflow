import type { Part } from '@/types'

/** How many to ask for by default: enough to get back above the reorder point, and a little over. */
export const suggestedQuantity = (part: Part) => Math.max(1, Math.ceil(Number(part.reorder_point) * 2 - Number(part.quantity_on_hand)))
