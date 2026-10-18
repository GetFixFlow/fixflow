import { describe, it, expect } from 'vitest'
import { changedFields, describeAction, removalSummary, roleChange } from '../auditText'
import type { AuditLine } from '@/api/audit'

const line = (metadata: AuditLine['metadata']): AuditLine => ({
  id: 1, action: 'x.y', resource_type: null, resource_id: null, resource_name: null, ip_address: null,
  created_at: '2026-10-16T12:00:00Z', metadata, user: null,
})

describe('describeAction', () => {
  it('words the actions the app writes', () => {
    expect(describeAction('asset.created')).toBe('Asset created')
    expect(describeAction('work_order.put_on_hold')).toBe('Work order put on hold')
    expect(describeAction('iot_rule.updated')).toBe('IoT rule updated')
    expect(describeAction('preventive_maintenance.deleted')).toBe('PM schedule deleted')
    expect(describeAction('api_key.revoked')).toBe('API key revoked')
    expect(describeAction('user.signed_in')).toBe('Signed in')
    expect(describeAction('user.deactivated')).toBe('Person deactivated')
    expect(describeAction('import.assets')).toBe('Imported assets')
    expect(describeAction('organization_settings.updated')).toBe('Company settings changed')
    expect(describeAction('part.stock_adjusted')).toBe('Part stock adjusted')
  })

  it('still says something readable for an action it has never heard of', () => {
    expect(describeAction('widget.polished')).toBe('Widget polished')
    expect(describeAction('mystery')).toBe('Mystery')
  })
})

describe('changedFields and roleChange', () => {
  it('reads the names of the fields that changed, from either way the log keeps them', () => {
    expect(changedFields(line({ changed: ['due_date', 'priority'] }))).toEqual(['due date', 'priority'])
    expect(changedFields(line({ changes: { unit_cost: [1, 2], name: ['a', 'b'] } }))).toEqual(['unit cost', 'name'])
    expect(changedFields(line({}))).toEqual([])
  })

  it('shows a role change, and nothing else about a value', () => {
    expect(roleChange(line({ values: { role: ['technician', 'manager'] } }))).toBe('technician → manager')
    expect(roleChange(line({ values: { hourly_rate: [10, 20] } }))).toBeNull()
    expect(roleChange(line({}))).toBeNull()
  })
})

describe('retention lines', () => {
  it('words what the nightly cleanup deleted', () => {
    expect(describeAction('retention.sensor_data_removed')).toBe('Old sensor data deleted')
    expect(describeAction('retention.audit_log_removed')).toBe('Old audit log lines deleted')
    expect(removalSummary({ ...line({ readings: 1200, summaries: 30, older_than_days: 365 }), action: 'retention.sensor_data_removed' }))
      .toBe('Deleted 1,200 readings, 30 hourly summaries, older than 365 days')
    expect(removalSummary({ ...line({ lines: 5, older_than_days: 730 }), action: 'retention.audit_log_removed' }))
      .toBe('Deleted 5 lines, older than 730 days')
  })

  it('says nothing for other lines, or a cleanup that deleted nothing', () => {
    expect(removalSummary(line({ readings: 5 }))).toBeNull()
    expect(removalSummary({ ...line({ readings: 0, summaries: 0 }), action: 'retention.sensor_data_removed' })).toBeNull()
  })
})
