import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { IoTRuleForm } from '../IoTRuleForm'
import { ApiKeyCreateModal } from '../ApiKeyCreateModal'
import { TestRuleModal } from '../TestRuleModal'
import type { IotRuleExtended } from '@/types'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>
}

const meta = { request_id: 'test', timestamp: '' }

beforeEach(() => {
  server.use(http.get('/api/v1/assets', () => HttpResponse.json({
    assets: [{ id: 1, name: 'Pump-01', asset_tag: 'P-1' }], meta,
  })))
})

describe('IoTRuleForm: what a screen reader announces for each control', () => {
  const next = () => userEvent.click(screen.getByRole('button', { name: /next/i }))

  it('names the asset to watch', () => {
    render(<IoTRuleForm onSubmit={async () => {}} mode="create" />, { wrapper })

    expect(screen.getByLabelText('Asset')).toHaveValue('')
  })

  it('names the name, metric, unit and threshold of the rule as the steps go on', async () => {
    render(<IoTRuleForm onSubmit={async () => {}} mode="create"
      defaultValues={{ asset_id: 1, name: 'Pump alert', metric_name: 'temperature', auto_create_wo: true }} />, { wrapper })

    expect(screen.getByLabelText('Rule Name')).toHaveValue('Pump alert')
    expect(screen.getByLabelText('Unit (optional)')).toBeInTheDocument()
    expect(screen.getByLabelText('Custom metric')).toBeInTheDocument()
    await next()
    expect(screen.getByLabelText(/threshold value/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/sustained for/i)).toBeInTheDocument()
    await next()
    expect(screen.getByLabelText('WO Title Template')).toBeInTheDocument()
    expect(screen.getByLabelText('WO Description Template')).toBeInTheDocument()
    expect(screen.getByLabelText('Cooldown (minutes)')).toBeInTheDocument()
  })

  it('names each set of choices as a group and says which choice is on', async () => {
    render(<IoTRuleForm onSubmit={async () => {}} mode="create"
      defaultValues={{ asset_id: 1, name: 'Pump alert', metric_name: 'temperature', auto_create_wo: true, wo_priority: 'high' }} />, { wrapper })

    const metric = screen.getByRole('group', { name: 'Metric' })
    expect(within(metric).getByRole('button', { name: 'temperature' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(metric).getByRole('button', { name: 'vibration' })).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(within(screen.getByRole('group', { name: 'Condition' })).getAllByRole('button').some((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true)

    await userEvent.click(screen.getByRole('button', { name: /next/i }))
    expect(within(screen.getByRole('group', { name: 'Auto-create Work Order on trigger?' })).getByRole('button', { name: 'Yes' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('group', { name: 'WO Priority' })).getByRole('button', { name: 'high' })).toHaveAttribute('aria-pressed', 'true')
  })
})

describe('ApiKeyCreateModal: what a screen reader announces for each control', () => {
  it('names the fields, and the scopes as a group, each with what it allows', () => {
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={() => {}} />, { wrapper })

    expect(screen.getByLabelText('Name *')).toBeInTheDocument()
    expect(screen.getByLabelText('Description')).toBeInTheDocument()
    expect(screen.getByLabelText('Expires At')).toBeInTheDocument()
    const scopes = screen.getByRole('group', { name: 'What this key may do' })
    const iot = within(scopes).getByRole('checkbox', { name: /Send sensor readings/ })
    expect(iot).toBeChecked()
    expect(iot).toHaveAccessibleDescription('For gateways and sensors that send readings to FixFlow.')
    expect(within(scopes).getByRole('checkbox', { name: /Read work orders, assets, locations and parts/ })).not.toBeChecked()
    expect(within(scopes).getByRole('checkbox', { name: /Also create and change work orders and assets/ })).not.toBeChecked()
  })

  it('turns a scope on by clicking its name', async () => {
    render(<ApiKeyCreateModal open onClose={() => {}} onCreated={() => {}} />, { wrapper })
    const read = screen.getByRole('checkbox', { name: /Read work orders, assets, locations and parts/ })

    expect(read).not.toBeChecked()
    await userEvent.click(screen.getByText('Read work orders, assets, locations and parts'))
    expect(read).toBeChecked()
  })
})

describe('TestRuleModal: what a screen reader announces for the value to try', () => {
  it('names the field, with the unit of the metric', () => {
    const rule = {
      id: 1, name: 'Pump-01 High Vibration', asset_id: 1, metric_name: 'vibration', metric_unit: 'mm/s', operator: 'gt', threshold_value: 8.5,
      enabled: true, status: 'active', auto_create_wo: false, cooldown_minutes: 60, organization_id: 1, created_at: '', updated_at: '',
    } as unknown as IotRuleExtended
    render(<TestRuleModal open rule={rule} onClose={() => {}} />, { wrapper })

    expect(screen.getByLabelText('Test Value (mm/s)')).toBeInTheDocument()
  })
})
