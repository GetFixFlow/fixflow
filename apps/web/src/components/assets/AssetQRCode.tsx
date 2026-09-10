import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Download, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type QRSize = 'sm' | 'md' | 'lg'

const SIZE_MAP: Record<QRSize, number> = {
  sm: 128,
  md: 192,
  lg: 256,
}

interface AssetQRCodeProps {
  assetId: number
  assetTag: string
  assetName?: string
  size?: QRSize
  showActions?: boolean
  className?: string
}

export function AssetQRCode({
  assetId,
  assetTag,
  assetName,
  size = 'md',
  showActions = true,
  className,
}: AssetQRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [dataUrl, setDataUrl] = useState<string>('')
  const px = SIZE_MAP[size]
  const qrValue = `${window.location.origin}/assets/${assetId}`

  useEffect(() => {
    if (!canvasRef.current) return
    QRCode.toCanvas(canvasRef.current, qrValue, {
      width: px,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    }).then(() => {
      setDataUrl(canvasRef.current?.toDataURL('image/png') ?? '')
    })
  }, [qrValue, px])

  const handleDownload = () => {
    if (!dataUrl) return
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `${assetTag}-qr.png`
    a.click()
  }

  const handlePrint = () => {
    const win = window.open('', '_blank')
    if (!win || !dataUrl) return
    win.document.write(`
      <html><head><title>QR Code – ${assetTag}</title>
      <style>
        body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:sans-serif; gap:8px; }
        img { display:block; }
        p { margin:0; font-size:14px; color:#374151; }
        small { color:#6b7280; font-family:monospace; }
        @media print { button { display:none; } }
      </style></head><body>
      <img src="${dataUrl}" width="${px}" height="${px}" alt="QR code for ${assetTag}" />
      ${assetName ? `<p>${assetName}</p>` : ''}
      <small>${assetTag}</small>
      <small style="font-size:11px;color:#9ca3af">Scan to view asset</small>
      </body></html>
    `)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <canvas
        ref={canvasRef}
        width={px}
        height={px}
        className="rounded-lg border border-gray-200 p-2 dark:border-gray-700"
        aria-label={`QR code for asset ${assetTag}`}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400">Scan to view asset</p>
      {showActions && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={!dataUrl}>
            <Download className="h-4 w-4" />
            Download
          </Button>
          <Button size="sm" variant="outline" onClick={handlePrint} disabled={!dataUrl}>
            <Printer className="h-4 w-4" />
            Print
          </Button>
        </div>
      )}
    </div>
  )
}
