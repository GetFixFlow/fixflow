import { apiClient } from './client'
import type { CustomField, CustomFieldEntity, CustomFieldKind } from '@/types/customFields'

export interface CustomFieldInput {
  entity: CustomFieldEntity
  label: string
  kind: CustomFieldKind
  options?: string[]
  required?: boolean
  in_list?: boolean
}

export type CustomFieldChanges = Partial<Pick<CustomFieldInput, 'label' | 'options' | 'required' | 'in_list'>> & { active?: boolean }

export const customFieldsApi = {
  list: (entity?: CustomFieldEntity) =>
    apiClient.get<{ custom_fields: CustomField[] }>('/custom_fields', { params: entity ? { entity } : undefined }),
  create: (custom_field: CustomFieldInput) => apiClient.post<{ data: CustomField }>('/custom_fields', { custom_field }),
  update: (id: number, custom_field: CustomFieldChanges) =>
    apiClient.patch<{ data: CustomField }>(`/custom_fields/${id}`, { custom_field }),
  remove: (id: number) => apiClient.delete(`/custom_fields/${id}`),
  reorder: (entity: CustomFieldEntity, ids: number[]) =>
    apiClient.patch<{ custom_fields: CustomField[] }>('/custom_fields/reorder', { entity, ids }),
}
