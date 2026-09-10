import { useState } from 'react'
import { Check, Copy, AlertTriangle } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/Button'
import { CodeSnippet } from './CodeSnippet'
import { toast } from 'sonner'
import type { ApiKeyWithSecret } from '@/types'

interface ApiKeyRevealModalProps {
  open: boolean
  apiKey: ApiKeyWithSecret | null
  onClose: () => void
}

const REST_EXAMPLE = (key: string) =>
  `curl -X POST https://your-domain/api/v1/iot/ingest \\
  -H "X-API-Key: ${key}" \\
  -H "Content-Type: application/json" \\
  -d '{"asset_id": "FF-000001", "metric": "temperature", "value": 72.4, "unit": "celsius"}'`

const MQTT_TOPIC = (key: string) => `fixflow/YOUR_ORG_TOKEN/assets/FF-000001/telemetry\n\n# Authenticate using your API key: ${key}`

export function ApiKeyRevealModal({ open, apiKey, onClose }: ApiKeyRevealModalProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!apiKey?.key) return
    navigator.clipboard.writeText(apiKey.key).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleDownload = () => {
    toast.info('PDF download coming soon')
  }

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) { /* prevent backdrop close */ } }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-[50%] top-[50%] z-50 w-full max-w-lg translate-x-[-50%] translate-y-[-50%] rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="space-y-4">
            {/* Success header */}
            <div className="text-center">
              <div className="text-4xl mb-2">✅</div>
              <Dialog.Title className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                API Key Created Successfully
              </Dialog.Title>
              <Dialog.Description className="sr-only">
                Your new API key is shown below. Copy it now as it will not be shown again.
              </Dialog.Description>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 p-3">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                IMPORTANT: Copy this key now. It will not be shown again.
              </p>
            </div>

            {/* Key value */}
            {apiKey && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase">Your API Key</p>
                <div className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-3">
                  <code className="flex-1 font-mono text-sm text-gray-900 dark:text-gray-100 break-all select-all">
                    {apiKey.key}
                  </code>
                  <button
                    onClick={handleCopy}
                    className="shrink-0 rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    aria-label="Copy to clipboard"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </button>
                </div>
                <Button variant="outline" className="w-full" onClick={handleCopy} aria-label="Copy">
                  {copied ? '✓ Copied!' : 'Copy to Clipboard'}
                </Button>
              </div>
            )}

            {/* Quick Setup Guide */}
            <div className="space-y-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Quick Setup Guide</p>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">REST API</p>
                <CodeSnippet
                  code={REST_EXAMPLE(apiKey?.key ?? 'YOUR_API_KEY_HERE')}
                  language="bash"
                  filename="POST /api/v1/iot/ingest"
                />
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase mb-2">MQTT</p>
                <CodeSnippet
                  code={MQTT_TOPIC(apiKey?.key ?? 'YOUR_API_KEY_HERE')}
                  language="text"
                  filename="MQTT Topic Format"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleDownload}>
                Download Setup Guide PDF
              </Button>
              <Button className="flex-1" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
