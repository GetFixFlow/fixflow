import { AlertTriangle } from 'lucide-react'
import { Trans, useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useDeleteLocation } from '@/hooks/useLocations'
import type { Location } from '@/types'

interface DeleteLocationModalProps {
  open: boolean
  onClose: () => void
  location: Location | null
}

export function DeleteLocationModal({ open, onClose, location }: DeleteLocationModalProps) {
  const { t } = useTranslation()
  const deleteMutation = useDeleteLocation()

  if (!location) return null

  const hasChildren = (location.children_count ?? 0) > 0
  const hasAssets = (location.asset_count ?? 0) > 0
  const canDelete = !hasChildren && !hasAssets

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(location.id)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={t('assets.locations.delete_title')}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <Trans i18nKey="assets.locations.delete_confirm" values={{ name: location.name }}
            components={{ b: <span className="font-semibold text-gray-900 dark:text-gray-100" /> }} />
        </p>

        {(hasChildren || hasAssets) && (
          <div className="rounded-md bg-red-50 p-3 dark:bg-red-900/20">
            <div className="flex gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
              <div className="text-sm text-red-700 dark:text-red-300">
                <p className="font-medium">{t('assets.locations.cannot_delete')}</p>
                <ul className="mt-1 list-inside list-disc space-y-0.5">
                  {hasChildren && (
                    <li>{t('assets.locations.has_children', { count: location.children_count })}</li>
                  )}
                  {hasAssets && (
                    <li>{t('assets.locations.has_assets', { count: location.asset_count })}</li>
                  )}
                </ul>
                <p className="mt-2">{t('assets.locations.remove_first')}</p>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canDelete}
            loading={deleteMutation.isPending}
            onClick={handleDelete}
          >
            {t('assets.locations.delete')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
