import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { WorkOrder } from '@/types'
import { FixFlowAssistDrawer } from '../FixFlowAssistDrawer'

const sendMock = vi.fn()
let mockMessages: { role: 'user' | 'assistant'; content: string; citations?: string[] }[] = []
let mockIsStreaming = false

vi.mock('@/hooks/useAssistChat', () => ({
  useAssistChat: () => ({ messages: mockMessages, isStreaming: mockIsStreaming, send: sendMock, stop: vi.fn() }),
}))

const startMock = vi.fn()
const stopMock = vi.fn()
let mockVoiceSupported = true

vi.mock('@/hooks/useVoiceInput', () => ({
  useVoiceInput: () => ({
    isSupported: mockVoiceSupported,
    isListening: false,
    transcript: '',
    start: startMock,
    stop: stopMock,
  }),
}))

const workOrder: WorkOrder = {
  id: 1,
  work_order_number: 'WO-000001',
  title: 'Pump-01 Oil Change',
  status: 'in_progress',
  priority: 'medium',
  work_order_type: 'preventive',
  organization_id: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  asset: { id: 1, name: 'Pump-01', asset_tag: 'FF-000001', status: 'operational', organization_id: 1, custom_fields: {} } as WorkOrder['asset'],
}

beforeEach(() => {
  mockMessages = []
  mockIsStreaming = false
  mockVoiceSupported = true
  sendMock.mockClear()
  startMock.mockClear()
  sessionStorage.clear()
})

describe('FixFlowAssistDrawer', () => {
  it('does not render its content when closed', () => {
    render(<FixFlowAssistDrawer open={false} onClose={vi.fn()} workOrder={workOrder} />)
    expect(screen.queryByText('✨ FixFlow Assist')).not.toBeInTheDocument()
  })

  it('renders context and suggested questions when open', () => {
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    expect(screen.getByText('✨ FixFlow Assist')).toBeInTheDocument()
    expect(screen.getByText(/Pump-01/)).toBeInTheDocument()
    expect(screen.getByText('What tools do I need for this job?')).toBeInTheDocument()
  })

  it('calls the close handler', () => {
    const onClose = vi.fn()
    render(<FixFlowAssistDrawer open onClose={onClose} workOrder={workOrder} />)
    fireEvent.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('sends a suggested question', () => {
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    fireEvent.click(screen.getByText('What tools do I need for this job?'))
    expect(sendMock).toHaveBeenCalledWith('What tools do I need for this job?')
  })

  it('renders streamed assistant messages progressively', () => {
    mockMessages = [
      { role: 'user', content: 'What tools do I need?' },
      { role: 'assistant', content: 'You will need a torque wrench.', citations: ['manual.pdf'] },
    ]
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    expect(screen.getByText(/torque wrench/)).toBeInTheDocument()
    expect(screen.getByText(/Source: manual.pdf/)).toBeInTheDocument()
  })

  it('shows a loading state while the assistant message is still empty', () => {
    mockMessages = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: '' },
    ]
    mockIsStreaming = true
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    expect(screen.getByText('Reading manual...')).toBeInTheDocument()
  })

  it('shows the mic button when voice input is supported', () => {
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    expect(screen.getByLabelText('Voice input')).toBeInTheDocument()
  })

  it('hides the mic button when voice input is unsupported', () => {
    mockVoiceSupported = false
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    expect(screen.queryByLabelText('Voice input')).not.toBeInTheDocument()
  })

  it('triggers speech recognition on mic click', () => {
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    fireEvent.click(screen.getByLabelText('Voice input'))
    expect(startMock).toHaveBeenCalled()
  })

  it('shows the AI disclaimer by default', () => {
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    expect(screen.getByText(/Always verify safety-critical information/)).toBeInTheDocument()
  })

  it('hides the disclaimer once dismissed for the session', () => {
    sessionStorage.setItem('ai_disclaimer_seen_fixflow_assist', 'true')
    render(<FixFlowAssistDrawer open onClose={vi.fn()} workOrder={workOrder} />)
    expect(screen.queryByText(/Always verify safety-critical information/)).not.toBeInTheDocument()
  })
})
