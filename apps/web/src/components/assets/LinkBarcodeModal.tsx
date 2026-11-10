import { useState } from 'react'
import type { AxiosError } from 'axios'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { AssetSelect } from '@/components/assets/AssetSelect'
import { assetsApi } from '@/api/assets'

interface LinkBarcodeModalProps {
  /** The code that was scanned and found nothing. */
  code: string
  onClose: () => void
  onLinked: (assetId: number) => void
}

/** Keeps a code that matched nothing as the barcode of an asset, so scanning it finds that asset from now on. */
export function LinkBarcodeModal({ code, onClose, onLinked }: LinkBarcodeModalProps) {
  const [assetId, setAssetId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [problem, setProblem] = useState('')

  const link = async () => {
    if (assetId === null) return
    setSaving(true)
    setProblem('')
    try {
      await assetsApi.update(assetId, { barcode: code })
      onLinked(assetId)
    } catch (err) {
      const reason = (err as AxiosError<{ error?: { message?: string } }>).response?.data?.error?.message
      setProblem(reason ?? 'Could not save it. Check the connection and try again.')
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="Link this code to an asset" description="It is kept as the asset's barcode. If the asset already has one, it is replaced.">
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Code: <span className="break-all font-mono">{code}</span>
        </p>
        <AssetSelect id="link-barcode-asset" label="Asset" value={assetId} onChange={setAssetId} />
        {problem && <p role="alert" className="text-sm text-red-600">{problem}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button type="button" onClick={link} disabled={assetId === null || saving} className="flex-1">
            {saving ? 'Saving…' : 'Link it'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
