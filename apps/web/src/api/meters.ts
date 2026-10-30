import { apiClient } from './client'

/** A running-hours counter, odometer or cycle count on an asset. */
export interface Meter {
  id: number
  asset_id: number
  name: string
  unit: string
  reading: number
  /** The sensor metric that feeds it, when it is not read by hand. */
  sensor_metric: string | null
  last_reading_at: string | null
}

export interface MeterReadingLine {
  id: number
  meter_id: number
  value: number
  recorded_at: string
  source: 'manual' | 'sensor'
  reset: boolean
  note: string | null
  recorded_by: string | null
}

export interface MeterInput {
  name: string
  unit: string
  sensor_metric?: string | null
  /** Where the meter stands today (new meters only). */
  reading?: string
}

export const metersApi = {
  list: (assetId: number) => apiClient.get<{ meters: Meter[] }>(`/assets/${assetId}/meters`),

  create: (assetId: number, data: MeterInput) =>
    apiClient.post<{ data: Meter }>(`/assets/${assetId}/meters`, { meter: data }),

  update: (id: number, data: Partial<MeterInput>) => apiClient.patch<{ data: Meter }>(`/meters/${id}`, { meter: data }),

  destroy: (id: number) => apiClient.delete(`/meters/${id}`),

  readings: (id: number) => apiClient.get<{ readings: MeterReadingLine[] }>(`/meters/${id}/readings`),

  record: (id: number, data: { value: string; note?: string; reset?: boolean }) =>
    apiClient.post<{ data: MeterReadingLine; meter: Meter }>(`/meters/${id}/readings`, { reading: data }),
}
