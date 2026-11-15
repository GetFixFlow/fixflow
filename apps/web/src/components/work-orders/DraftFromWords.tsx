import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/Button'
import { apiErrorMessage } from '@/lib/apiError'
import { useAI, useDraftWorkOrder } from '@/hooks/useAI'
import type { DraftAsset, WorkOrderDraft } from '@/api/ai'

/** What the form is given to fill in: the draft, and a number that changes each time so the same draft can be applied again. */
export interface AppliedDraft {
  nonce: number
  title: string
  description: string
  priority: WorkOrderDraft['priority']
  asset_id: number | null
}

interface Props {
  /** Fills the work order form in. */
  onDraft: (draft: AppliedDraft) => void
  /** The asset was already chosen for the work order (it came from an asset's page), so none is offered. */
  assetLocked?: boolean
}

/**
 * "Describe the problem in your own words": a few plain words become a draft work order that the form is filled in with. The person
 * reads and changes it, then creates the work order as usual: nothing is saved until they do. Shown only while AI is on and the
 * administrator has not switched this off.
 */
export function DraftFromWords({ onDraft, assetLocked = false }: Props) {
  const { t } = useTranslation()
  const { features, provider } = useAI()
  const [text, setText] = useState('')
  const [nonce, setNonce] = useState(0)
  const [candidates, setCandidates] = useState<DraftAsset[]>([])
  const draft = useDraftWorkOrder()

  if (!features.draft) return null

  const apply = (made: WorkOrderDraft, assetId: number | null) => {
    setNonce((previous) => previous + 1)
    onDraft({ nonce: nonce + 1, title: made.title, description: made.description, priority: made.priority, asset_id: assetId })
  }

  const make = () =>
    draft.mutate(text, {
      onSuccess: (made) => {
        setCandidates(made.asset || assetLocked ? [] : made.asset_candidates)
        apply(made, made.asset?.id ?? null)
      },
    })

  const choose = (asset: DraftAsset) => {
    if (!draft.data) return
    setCandidates([])
    apply(draft.data, asset.id)
  }

  return (
    <section aria-labelledby="draft-heading" className="rounded-lg border border-brand-200 bg-brand-50 p-4 dark:border-brand-800 dark:bg-brand-900/10">
      <h2 id="draft-heading" className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-200">
        <Sparkles className="h-4 w-4 text-brand-600 dark:text-brand-400" aria-hidden="true" />
        {t('ai.draft.title')}
      </h2>
      <label htmlFor="draft-words" className="mt-2 block text-sm text-gray-700 dark:text-gray-300">{t('ai.draft.label')}</label>
      <textarea
        id="draft-words"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
        maxLength={2000}
        placeholder={t('ai.draft.placeholder')}
        aria-describedby="draft-help"
        className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
      />
      <p id="draft-help" className="mt-1 text-xs text-gray-600 dark:text-gray-400">
        {t('ai.draft.dictate')} {t(`ai.draft.note.${provider ?? 'anthropic'}`)}
      </p>
      <Button type="button" size="sm" className="mt-2" disabled={text.trim().length < 8 || draft.isPending} onClick={make}>
        {draft.isPending ? t('ai.draft.making') : t('ai.draft.make')}
      </Button>

      {draft.isSuccess && (
        <div role="status" className="mt-3 text-sm text-gray-800 dark:text-gray-200">
          <p className="font-medium">{t('ai.draft.done')}</p>
          {candidates.length > 0 && (
            <div className="mt-2">
              <p className="text-gray-700 dark:text-gray-300">{t('ai.draft.which_asset')}</p>
              <ul className="mt-1 flex flex-wrap gap-2">
                {candidates.map((asset) => (
                  <li key={asset.id}>
                    <Button type="button" size="sm" variant="outline" onClick={() => choose(asset)}>
                      {asset.name}{asset.location_path ? ` (${asset.location_path})` : ''}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      {draft.isError && (
        <p role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">{apiErrorMessage(draft.error, t('ai.draft.failed'))}</p>
      )}
    </section>
  )
}
