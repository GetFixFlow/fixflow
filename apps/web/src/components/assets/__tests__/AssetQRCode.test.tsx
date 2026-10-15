import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import QRCode from 'qrcode'
import { AssetQRCode } from '../AssetQRCode'

vi.mock('qrcode', () => ({ default: { toCanvas: vi.fn(() => Promise.resolve()) } }))

describe('AssetQRCode', () => {
  beforeEach(() => vi.mocked(QRCode.toCanvas).mockClear())

  it('links the label to the public request form, by the random code', async () => {
    render(<AssetQRCode assetId={7} assetTag="FF-000007" publicCode="Ab3dEf" showActions={false} />)

    await waitFor(() => expect(QRCode.toCanvas).toHaveBeenCalled())
    const value = vi.mocked(QRCode.toCanvas).mock.calls[0][1]
    expect(value).toBe(`${window.location.origin}/request?asset=Ab3dEf`)
    expect(value).not.toContain('/assets/')
    expect(screen.getByText('Scan to report a problem')).toBeInTheDocument()
  })

  it('falls back to the asset page for an asset the server sent no code for', async () => {
    render(<AssetQRCode assetId={7} assetTag="FF-000007" showActions={false} />)

    await waitFor(() => expect(QRCode.toCanvas).toHaveBeenCalled())
    expect(vi.mocked(QRCode.toCanvas).mock.calls[0][1]).toBe(`${window.location.origin}/assets/7`)
    expect(screen.getByText('Scan to view asset')).toBeInTheDocument()
  })
})
