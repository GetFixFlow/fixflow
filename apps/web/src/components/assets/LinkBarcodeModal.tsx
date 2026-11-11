import { useState } from 'react'
import type { AxiosError } from 'axios'
import { Trans, useTranslation } from 'react-i18next'
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
  const { t } = useTranslation()
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
      setProblem(reason ?? t('assets.link_barcode.save_failed'))
      setSaving(false)
    }
  }

  return (
    <Modal open onClose={onClose} title={t('assets.link_barcode.title')} description={t('assets.link_barcode.description')}>
      <div className="space-y-4">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          <Trans i18nKey="assets.link_barcode.code" values={{ code }} components={{ code: <span className="break-all font-mono" /> }} />
        </p>
        <AssetSelect id="link-barcode-asset" label={t('assets.link_barcode.asset')} value={assetId} onChange={setAssetId} />
        {problem && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{problem}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.actions.cancel')}</Button>
          <Button type="button" onClick={link} disabled={assetId === null || saving} className="flex-1">
            {saving ? t('common.actions.saving') : t('assets.link_barcode.link')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
