import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode'
import { Camera, AlertCircle, Link2, ScanLine, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { LinkBarcodeModal } from '@/components/assets/LinkBarcodeModal'
import { assetsApi } from '@/api/assets'
import { useAuthStore } from '@/stores/authStore'
import type { LookupMatch } from '@/types/scanning'

type ScannerState = 'idle' | 'scanning' | 'looking' | 'error' | 'permission_denied' | 'not_supported'

/** What the camera reads: our QR labels, and the barcodes found on equipment, parts and shelves. */
const FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.ITF,
]

/** A wide box: a barcode is wide and short, and a QR code fits in it too. */
const scanBox = (width: number, height: number) => ({
  width: Math.floor(width * 0.9),
  height: Math.max(50, Math.floor(Math.min(width, height) * 0.5)),
})

const MATCH_LABELS: Record<string, string> = {
  asset_tag: 'tag',
  barcode: 'barcode',
  serial_number: 'serial number',
  label: 'label',
  link: 'link',
}

/** "Matched the barcode and the serial number", for the list of assets a code could be. */
const matchedOn = (match: LookupMatch) => match.matched_on.map((field) => MATCH_LABELS[field] ?? field).join(' and ')

type Outcome = { code: string; matches: LookupMatch[] } | { code: string; failed: true }

export function QRScannerPage() {
  const navigate = useNavigate()
  const role = useAuthStore((s) => s.user?.role)
  const canLink = role === 'admin' || role === 'manager'
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const handledRef = useRef(false)
  const [state, setState] = useState<ScannerState>('idle')
  const [typed, setTyped] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [linking, setLinking] = useState<string | null>(null)

  // A person with a handheld scanner (it types the code and presses Enter) has the box ready; on a phone, no keyboard pops up.
  const hasPointer = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches

  /** Finds the asset a code belongs to and opens it, or says there is none or asks which. */
  const resolve = async (code: string) => {
    setState('looking')
    try {
      const { data } = await assetsApi.lookup(code)
      if (data.matches.length === 1) {
        navigate(`/assets/${data.matches[0].id}`)
        return
      }
      setOutcome({ code, matches: data.matches })
    } catch {
      setOutcome({ code, failed: true })
    }
    setState('idle')
  }

  const startScanner = async () => {
    setOutcome(null)
    handledRef.current = false
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
      const scanner = new Html5Qrcode('qr-reader', { formatsToSupport: FORMATS, verbose: false, useBarCodeDetectorIfSupported: true })
      scannerRef.current = scanner

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: scanBox },
        (decodedText) => {
          if (handledRef.current) return // the camera can read the same code again before it has stopped
          handledRef.current = true
          scanner.stop().catch(() => {})
          if (navigator.vibrate) navigator.vibrate(200)
          void resolve(decodedText.trim())
        },
        () => {
          // Nothing readable in view yet, keep scanning
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault()
    const code = typed.trim()
    if (!code) return
    scannerRef.current?.stop().catch(() => {})
    handledRef.current = true
    setTyped('')
    void resolve(code)
  }

  const scanAgain = () => {
    scannerRef.current?.clear?.()
    void startScanner()
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-900 text-white">
      {/* Header */}
      <div className="w-full flex items-center justify-center py-4">
        <h1 className="text-lg font-bold tracking-wide">FixFlow</h1>
      </div>

      <div className="flex w-full max-w-sm flex-1 flex-col items-center gap-5 px-4 pt-4 pb-8">
        {/* Camera area */}
        <div className="relative w-full">
          <div
            id="qr-reader"
            className="aspect-square w-full overflow-hidden rounded-2xl bg-gray-800"
          />
          {state === 'scanning' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-1/2 w-[90%] rounded-xl border-2 border-brand-400 opacity-70" />
            </div>
          )}
          {(state === 'idle' || state === 'looking') && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-gray-800">
              {state === 'looking' ? <ScanLine className="h-16 w-16 animate-pulse text-brand-400" /> : <Camera className="h-16 w-16 text-gray-600" />}
            </div>
          )}
          {state === 'permission_denied' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gray-800 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-red-400" />
              <p className="text-sm text-gray-300">Camera access was denied.</p>
              <p className="text-xs text-gray-500">
                Enable camera permissions in your browser settings, or type the code below.
              </p>
            </div>
          )}
          {state === 'not_supported' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-gray-800 p-6 text-center">
              <AlertCircle className="h-10 w-10 text-yellow-400" />
              <p className="text-sm text-gray-300">Camera not available.</p>
              <p className="text-xs text-gray-500">Type or scan the code below.</p>
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
          <p className="text-center text-sm text-gray-400">Point the camera at a QR code or a barcode</p>
        )}
        {state === 'looking' && <p role="status" className="text-center text-sm text-gray-400">Looking it up…</p>}

        {/* What the scan found, when it was not exactly one asset */}
        {outcome && 'failed' in outcome && (
          <div role="alert" className="w-full space-y-3 rounded-xl bg-gray-800 p-4 text-center">
            <p className="text-sm text-gray-200">Could not look up {outcome.code}. Check the connection and try again.</p>
            <Button size="sm" onClick={() => void resolve(outcome.code)}>Try again</Button>
          </div>
        )}
        {outcome && 'matches' in outcome && outcome.matches.length === 0 && (
          <div role="alert" className="w-full space-y-3 rounded-xl bg-gray-800 p-4 text-center">
            <p className="text-sm text-gray-200">No asset has the code <span className="break-all font-mono">{outcome.code}</span>.</p>
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" onClick={scanAgain}>Scan again</Button>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/assets?search=${encodeURIComponent(outcome.code)}`}><Search className="h-4 w-4" />Search assets</Link>
              </Button>
              {canLink && outcome.code.length <= 64 && (
                <Button size="sm" variant="outline" onClick={() => setLinking(outcome.code)}>
                  <Link2 className="h-4 w-4" />Link it to an asset
                </Button>
              )}
            </div>
          </div>
        )}
        {outcome && 'matches' in outcome && outcome.matches.length > 1 && (
          <div className="w-full space-y-2 rounded-xl bg-gray-800 p-4">
            <p className="text-sm text-gray-200">
              More than one asset has the code <span className="break-all font-mono">{outcome.code}</span>. Which one?
            </p>
            <ul className="space-y-1">
              {outcome.matches.map((match) => (
                <li key={match.id}>
                  <button
                    onClick={() => navigate(`/assets/${match.id}`)}
                    className="w-full rounded-lg bg-gray-700 px-3 py-2 text-left hover:bg-gray-600"
                  >
                    <span className="block text-sm font-medium">{match.name}</span>
                    <span className="block text-xs text-gray-400">
                      {match.asset_tag}{match.location ? `, ${match.location}` : ''}. Matched the {matchedOn(match)}.
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <Button size="sm" variant="outline" onClick={scanAgain}>Scan again</Button>
          </div>
        )}

        {/* Typing, or a handheld scanner: it types the code and presses Enter */}
        <form onSubmit={submitTyped} className="w-full space-y-2">
          <label htmlFor="scan-code" className="block text-sm text-gray-400">Or type or scan a code</label>
          <Input
            id="scan-code"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="Asset tag, barcode or serial number"
            autoFocus={hasPointer}
            autoComplete="off"
            className="bg-gray-800 border-gray-600 text-white placeholder:text-gray-500"
          />
          <Button type="submit" className="w-full" disabled={!typed.trim() || state === 'looking'}>
            Look up
          </Button>
        </form>
      </div>

      {linking && (
        <LinkBarcodeModal
          code={linking}
          onClose={() => setLinking(null)}
          onLinked={(assetId) => {
            toast.success('Linked. Scanning it will now open this asset.')
            navigate(`/assets/${assetId}`)
          }}
        />
      )}
    </div>
  )
}
