/** Which asset a scanned or typed code belongs to (GET /assets/lookup). */
export interface LookupMatch {
  id: number
  name: string
  asset_tag: string
  barcode: string | null
  serial_number: string | null
  location: string | null
  /** What the code was: "label" (one of our QR labels), "link", "asset_tag", "barcode" or "serial_number". */
  matched_on: string[]
}

/** What a printed label needs (GET /assets/labels). */
export interface LabelAsset {
  id: number
  name: string
  asset_tag: string
  barcode: string | null
  public_code: string
  location_name: string | null
}

export interface LabelList {
  labels: LabelAsset[]
  /** How many assets match; more than `labels` holds when `truncated`. */
  total: number
  truncated: boolean
}

export interface LabelFilters {
  ids?: string
  search?: string
  status?: string
  location_id?: number
}
