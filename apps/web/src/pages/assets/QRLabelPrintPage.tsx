import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams, Link } from 'react-router-dom'
import type { AxiosError } from 'axios'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Printer } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { LocationSelect } from '@/components/shared/LocationSelect'
import { AssetLabelSheet, type LabelOptions } from '@/components/assets/AssetLabelSheet'
import { useAssetLabels } from '@/hooks/useAssets'
import { useLocations } from '@/hooks/useLocations'
import { useDebouncedValue } from '@/hooks/useParts'
import { drawQrCodes, LABEL_SIZES, labelQrValue, PAPER, printStyles, type LabelSizeKey, type PaperKey } from '@/lib/labelSheet'
import { label as word } from '@/i18n'

const PRINT_ID = 'label-print-root'
const PREVIEW_LIMIT = 12
const SELECT_CLASS =
  'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

/**
 * A sheet of labels for many assets at once: choose them by place, status or search (up to 500), or arrive with the
 * ones picked on the Assets list, and print. Each label carries the QR to report a problem and, if wanted, a barcode of the tag.
 */
export function QRLabelPrintPage() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  const origin = window.location.origin

  // Assets picked on the list arrive as ?ids=; the filters narrow it by place, status or text. Changing a filter lets go of the picks.
  const [picked, setPicked] = useState(searchParams.get('ids') ?? '')
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [status, setStatus] = useState(searchParams.get('status') ?? '')
  const [locationId, setLocationId] = useState<number | null>(Number(searchParams.get('location_id')) || null)
  const [options, setOptions] = useState<LabelOptions>({ size: 'medium', barcode: true, place: true })
  const [paper, setPaper] = useState<PaperKey>('a4')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [qrCodes, setQrCodes] = useState<Record<string, string>>({})
  const drawnRef = useRef<Record<string, string>>({})

  const debouncedSearch = useDebouncedValue(search, 300)
  const { data: locationsData } = useLocations()
  const locations = locationsData ?? []
  const { data, isLoading, error } = useAssetLabels({
    ids: picked || undefined,
    search: debouncedSearch || undefined,
    status: status || undefined,
    location_id: locationId ?? undefined,
  })
  const labels = useMemo(() => data?.labels ?? [], [data])
  const forbidden = (error as AxiosError | null)?.response?.status === 403

  // What came from the list starts chosen; after a filter changes, only what is still in the results stays chosen.
  useEffect(() => {
    if (!data) return
    if (picked) setSelected(new Set(data.labels.map((label) => label.id)))
    else setSelected((prev) => new Set([...prev].filter((id) => data.labels.some((label) => label.id === id))))
  }, [data, picked])

  const chosen = useMemo(() => labels.filter((label) => selected.has(label.id)), [labels, selected])
  const wanted = useMemo(() => chosen.map((label) => labelQrValue(label, origin)), [chosen, origin])

  // Draw the QR codes of what is chosen, once each.
  useEffect(() => {
    const missing = wanted.filter((value) => !drawnRef.current[value])
    if (missing.length === 0) return
    void drawQrCodes(missing, (done) => {
      drawnRef.current = { ...drawnRef.current, ...done }
      setQrCodes(drawnRef.current)
    })
  }, [wanted])

  const ready = chosen.length > 0 && wanted.every((value) => qrCodes[value])

  const changeFilter = <T,>(set: (value: T) => void) => (value: T) => {
    set(value)
    setPicked('')
  }

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link to="/assets">
          <ArrowLeft className="h-4 w-4" />
          {t('assets.print.assets')}
        </Link>
      </Button>

      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('assets.print.title')}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('assets.print.chosen', { count: chosen.length })}
          </p>
        </div>
        <Button onClick={() => window.print()} disabled={!ready}>
          <Printer className="h-4 w-4" />
          {chosen.length > 0 && !ready ? t('assets.print.preparing') : t('assets.print.title')}
        </Button>
      </div>

      {forbidden ? (
        <p role="alert" className="rounded-lg border border-gray-200 p-6 text-center text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">
          {t('assets.print.forbidden')}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Left: what to print */}
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-3 p-4">
                <h2 className="font-medium text-gray-900 dark:text-gray-100">{t('assets.print.which')}</h2>
                {picked && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('assets.print.picked')}{' '}
                    <button onClick={() => setPicked('')} className="text-brand-600 underline dark:text-brand-400">{t('assets.print.show_all')}</button>
                  </p>
                )}
                <Input id="label-search" label={t('assets.print.search')} placeholder={t('assets.print.search_placeholder')} value={search} onChange={(e) => changeFilter(setSearch)(e.target.value)} />
                <LocationSelect id="label-location" label={t('assets.print.place')} locations={locations} value={locationId} onChange={changeFilter(setLocationId)} placeholder={t('assets.print.anywhere')} />
                <div>
                  <label htmlFor="label-status" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('assets.print.status')}</label>
                  <select id="label-status" value={status} onChange={(e) => changeFilter(setStatus)(e.target.value)} className={SELECT_CLASS}>
                    <option value="">{t('assets.print.any')}</option>
                    {['operational', 'degraded', 'down', 'decommissioned'].map((value) => <option key={value} value={value}>{word('status', value)}</option>)}
                  </select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-3 p-4">
                <h2 className="font-medium text-gray-900 dark:text-gray-100">{t('assets.print.the_label')}</h2>
                <div>
                  <label htmlFor="label-size" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('assets.print.size')}</label>
                  <select id="label-size" value={options.size} onChange={(e) => setOptions({ ...options, size: e.target.value as LabelSizeKey })} className={SELECT_CLASS}>
                    {(Object.keys(LABEL_SIZES) as LabelSizeKey[]).map((key) => <option key={key} value={key}>{t(`assets.print.size_${key}`)}</option>)}
                  </select>
                </div>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={options.barcode} onChange={(e) => setOptions({ ...options, barcode: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
                  {t('assets.print.barcode')}
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" checked={options.place} onChange={(e) => setOptions({ ...options, place: e.target.checked })} className="h-4 w-4 rounded border-gray-300" />
                  {t('assets.print.the_place')}
                </label>
                <div>
                  <label htmlFor="label-paper" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('assets.print.paper')}</label>
                  <select id="label-paper" value={paper} onChange={(e) => setPaper(e.target.value as PaperKey)} className={SELECT_CLASS}>
                    {(Object.keys(PAPER) as PaperKey[]).map((key) => <option key={key} value={key}>{t(`assets.print.paper_${key}`)}</option>)}
                  </select>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {t('assets.print.real_size')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-medium text-gray-900 dark:text-gray-100">{t('assets.print.choose')}</h2>
                  <div className="flex gap-3 text-xs">
                    <button onClick={() => setSelected(new Set(labels.map((label) => label.id)))} className="text-brand-600 hover:underline dark:text-brand-400">
                      {t('assets.print.choose_all', { count: labels.length })}
                    </button>
                    <button onClick={() => setSelected(new Set())} className="text-brand-600 hover:underline dark:text-brand-400">{t('assets.print.none')}</button>
                  </div>
                </div>
                {data?.truncated && (
                  <p role="status" className="text-xs text-amber-700 dark:text-amber-400">
                    {t('assets.print.truncated', { total: data.total, shown: labels.length })}
                  </p>
                )}
                <div className="max-h-72 space-y-1 overflow-auto">
                  {isLoading && <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('assets.print.loading')}</p>}
                  {!isLoading && labels.length === 0 && <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">{t('assets.print.no_match')}</p>}
                  {labels.map((label) => (
                    <label key={label.id} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <input type="checkbox" checked={selected.has(label.id)} onChange={() => toggle(label.id)} className="rounded border-gray-300 text-brand-600 dark:text-brand-400" />
                      <span className="flex-1 truncate text-sm text-gray-700 dark:text-gray-300">{label.name}</span>
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">{label.asset_tag}</span>
                    </label>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: preview */}
          <div className="lg:col-span-2">
            <Card>
              <CardContent className="p-4">
                <h2 className="mb-3 font-medium text-gray-900 dark:text-gray-100">{t('assets.print.preview')}</h2>
                {chosen.length === 0 ? (
                  <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('assets.print.choose_to_preview')}</p>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <AssetLabelSheet assets={chosen.slice(0, PREVIEW_LIMIT)} options={options} qrCodes={qrCodes} origin={origin} />
                    </div>
                    {chosen.length > PREVIEW_LIMIT && (
                      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t('assets.print.showing_first', { limit: PREVIEW_LIMIT, count: chosen.length })}</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* What is printed: a copy of the sheet directly in <body>, shown only when printing, while the rest of the page is hidden. */}
      {createPortal(
        <>
          <style>{printStyles(PRINT_ID, paper)}</style>
          <AssetLabelSheet id={PRINT_ID} assets={chosen} options={options} qrCodes={qrCodes} origin={origin} />
        </>,
        document.body,
      )}
    </div>
  )
}
