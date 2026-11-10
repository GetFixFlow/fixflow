import QRCode from 'qrcode'
import type { LabelAsset } from '@/types/scanning'

export type LabelSizeKey = 'small' | 'medium' | 'large'
export type PaperKey = 'a4' | 'letter'

export interface LabelSize {
  label: string
  /** Millimetres. */
  width: number
  height: number
  /** Points. */
  nameSize: number
  tagSize: number
  /** The barcode's height in millimetres. */
  barHeight: number
}

/**
 * Label sizes, in millimetres, so that the printed label is the size it says on any printer at 100% scale. The smallest
 * still leaves a Code 128 barcode of a tag like FF-000001 wide enough (about a quarter of a millimetre a bar) to scan.
 */
export const LABEL_SIZES: Record<LabelSizeKey, LabelSize> = {
  small: { label: 'Small, 60 × 30 mm', width: 60, height: 30, nameSize: 7.5, tagSize: 7, barHeight: 7 },
  medium: { label: 'Medium, 80 × 40 mm', width: 80, height: 40, nameSize: 10, tagSize: 8.5, barHeight: 10 },
  large: { label: 'Large, 100 × 60 mm', width: 100, height: 60, nameSize: 14, tagSize: 11, barHeight: 14 },
}

/** Millimetres: the margin round a label, the gap between its QR code and its text, and the clear space each side of a barcode. */
export const LABEL_PADDING = 1.5
export const LABEL_GAP = 1.5
export const BARCODE_QUIET_ZONE = 2.5

/** The narrowest bar of a Code 128 barcode with `modules` modules on a label of this size, in millimetres. Below about 0.2 a printer and a camera struggle. */
export function barcodeModuleWidth(size: LabelSize, modules: number): number {
  const qr = size.height - 2 * LABEL_PADDING // the QR code is square and fills the label's height
  const column = size.width - 2 * LABEL_PADDING - qr - LABEL_GAP
  return (column - 2 * BARCODE_QUIET_ZONE) / modules
}

export const PAPER: Record<PaperKey, { label: string; css: string }> = {
  a4: { label: 'A4', css: 'A4' },
  letter: { label: 'US Letter', css: 'letter' },
}

/** What the QR on a label holds: the link to the request form for that asset, the same one the asset page shows. */
export const labelQrValue = (asset: Pick<LabelAsset, 'public_code'>, origin: string) =>
  `${origin}/request?asset=${encodeURIComponent(asset.public_code)}`

/** The QR for each label as a picture, keyed by the value it holds. Drawn a few at a time so the screen stays responsive. */
export async function drawQrCodes(values: string[], onProgress: (done: Record<string, string>) => void): Promise<void> {
  const done: Record<string, string> = {}
  for (let i = 0; i < values.length; i += 20) {
    const chunk = values.slice(i, i + 20)
    const urls = await Promise.all(chunk.map((value) => QRCode.toDataURL(value, { margin: 1, width: 400, errorCorrectionLevel: 'M' })))
    chunk.forEach((value, index) => { done[value] = urls[index] })
    onProgress({ ...done })
  }
}

/**
 * The style that makes the browser print only the label sheet: the page is hidden and the sheet, which sits directly in
 * <body>, is shown. The paper and its margin are set here too. `id` is the sheet's id.
 */
export const printStyles = (id: string, paper: PaperKey) => `
#${id} { display: none; }
@page { size: ${PAPER[paper].css}; margin: 8mm; }
@media print {
  html, body { margin: 0 !important; padding: 0 !important; }
  body > *:not(#${id}) { display: none !important; }
  #${id} { display: flex !important; }
}
`

/** The address part that opens the label page with the Assets list's filters already chosen ("?search=pump&status=down"), or nothing. */
export function labelQuery(filters: { search: string; status: string; location_id: number | null }): string {
  const params = new URLSearchParams()
  if (filters.search) params.set('search', filters.search)
  if (filters.status) params.set('status', filters.status)
  if (filters.location_id != null) params.set('location_id', String(filters.location_id))
  const text = params.toString()
  return text ? `?${text}` : ''
}
