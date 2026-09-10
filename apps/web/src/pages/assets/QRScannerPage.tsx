import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Html5Qrcode } from 'html5-qrcode'
import { Camera, Keyboard, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type ScannerState = 'idle' | 'scanning' | 'error' | 'permission_denied' | 'not_supported'

export function QRScannerPage() {
  const navigate = useNavigate()
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const [state, setState] = useState<ScannerState>('idle')
  const [manualTag, setManualTag] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const startScanner = async () => {
    if (!Html5Qrcode.getCameras) {
      setState('not_supported')
      return
    }

    try {
      const cameras = await Html5Qrcode.getCameras()
      if (!cameras || cameras.length === 0) {
        setState('not_supported')
        return
      }

      setState('scanning')
      const scanner = new Html5Qrcode('qr-reader')
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          scanner.stop().catch(() => {})
          if (navigator.vibrate) navigator.vibrate(200)

          // Parse QR: could be URL like /assets/123 or fixflow://assets/123
          const match = decodedText.match(/\/assets\/(\d+)/)
          if (match) {
            navigate(`/assets/${match[1]}`)
          } else {
            // Try to treat as asset tag
            navigate(`/assets?search=${encodeURIComponent(decodedText)}`)
          }
        },
        () => {
          // Not a QR code yet, keep scanning
        },
      )
    } catch (err) {
      const msg = String(err)
      if (msg.includes('NotAllowedError') || msg.includes('Permission')) {
        setState('permission_denied')
      } else {
        setState('error')
        setErrorMsg(msg)
      }
    }
  }

  useEffect(() => {
    startScanner()
    return () => {
      scannerRef.current?.stop().catch(() => {})
    }
  }, [])

  const handleManualLookup = () => {
    if (!manualTag.trim()) return
    navigate(`/assets?search=${encodeURIComponent(manualTag.trim())}`)
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-900 text-white">
      {/* Header */}
      <div className="w-full flex items-center justify-center py-4">
        <h1 className="text-lg font-bold tracking-wide">FixFlow</h1>
      </div>

      <div className="flex w-full max-w-sm flex-1 flex-col items-center gap-6 px-4 pt-4">
        {/* Camera area */}
        <div className="relative w-full">
          <div
            id="qr-reader"
            className="aspect-square w-full overflow-hidden rounded-2xl bg-gray-800"
          />
          {state === 'scanning' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-xl border-2 border-brand-400 opacity-70" />
            </div>
          )}
          {state === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gray-800">
              <Camera className="h-16 w-16 text-gray-600" />
            </div>
          )}
          {state === 'permission_denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gray-800 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm text-gray-300">Camera access was denied.</p>
              <p className="text-xs text-gray-500">
                Enable camera permissions in your browser settings.
              </p>
            </div>
          )}
          {state === 'not_supported' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gray-800 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-yellow-400" />
              <p className="text-sm text-gray-300">Camera not available.</p>
              <p className="text-xs text-gray-500">Use manual entry below.</p>
            </div>
          )}
          {state === 'error' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gray-800 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm text-gray-300">Scanner error.</p>
              <p className="text-xs text-gray-500">{errorMsg}</p>
              <Button size="sm" onClick={startScanner}>Try again</Button>
            </div>
          )}
        </div>

        {state === 'scanning' && (
          <p className="text-center text-sm text-gray-400">
            Point camera at asset QR code
          </p>
        )}

        {/* Manual entry toggle */}
        <button
          onClick={() => setShowManual((v) => !v)}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white"
        >
          <Keyboard className="h-4 w-4" />
          Enter Tag Manually
        </button>

        {showManual && (
          <div className="w-full space-y-2">
            <Input
              value={manualTag}
              onChange={(e) => setManualTag(e.target.value)}
              placeholder="Enter asset tag (e.g. FF-000001)"
              className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
              onKeyDown={(e) => e.key === 'Enter' && handleManualLookup()}
            />
            <Button className="w-full" onClick={handleManualLookup} disabled={!manualTag.trim()}>
              Look Up Asset
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
