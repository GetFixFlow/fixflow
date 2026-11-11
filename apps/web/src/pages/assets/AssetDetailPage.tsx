import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  ArrowLeft,
  ChevronRight,
  ClipboardList,
  Pencil,
  Printer,
  MoreVertical,
  Copy,
  MapPin,
  Hash,
  Wrench,
  Calendar,
  ShieldCheck,
} from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardTitle } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { AssetStatusBadge } from '@/components/assets/AssetStatusBadge'
import { AssetStatusChanger } from '@/components/assets/AssetStatusChanger'
import { AssetQRCode } from '@/components/assets/AssetQRCode'
import { AssetTimeline, type TimelineEvent } from '@/components/assets/AssetTimeline'
import { SensorReadingCard } from '@/components/assets/SensorReadingCard'
import { SensorChart } from '@/components/assets/SensorChart'
import { warrantyStatus } from '@/lib/warranty'
import { AssetDowntime } from '@/components/assets/AssetDowntime'
import { AssetDocuments } from '@/components/assets/AssetDocuments'
import { AssetMeters } from '@/components/assets/AssetMeters'
import { LocationBreadcrumb } from '@/components/shared/LocationBreadcrumb'
import { useAsset, useDeleteAsset } from '@/hooks/useAssets'
import { useLocations } from '@/hooks/useLocations'
import { useWorkOrders } from '@/hooks/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'
import { useRealtimeStore } from '@/stores/realtimeStore'
import { Badge, statusBadge, priorityBadge } from '@/components/ui/Badge'
import { formatDate, formatDateTime } from '@/lib/localeFormat'
import { timeAgo } from '@/lib/timeAgo'
import { label as word } from '@/i18n'

function InfoCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType
  label: string
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-gray-100 p-2 dark:bg-gray-700">
            <Icon className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
            <div className="mt-0.5 text-sm font-medium text-gray-900 dark:text-gray-100">{children}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

const WARRANTY_TONE = {
  ok: 'border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  soon: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300',
  ended: 'border-gray-200 bg-gray-100 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400',
} as const

function WarrantyNote({ endsOn }: { endsOn: string }) {
  const { t } = useTranslation()
  const { tone, text } = warrantyStatus(endsOn)
  return (
    <div role="status" className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${WARRANTY_TONE[tone]}`}>
      <ShieldCheck className="h-4 w-4 shrink-0" />
      <span>{t('assets.warranty.note', { text, date: formatDate(endsOn) })}</span>
    </div>
  )
}

export function AssetDetailPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'manager'
  const isAdmin = user?.role === 'admin'
  const assetId = parseInt(id ?? '0', 10)

  const { data: asset, isLoading, error } = useAsset(assetId)
  const { data: locationsData } = useLocations()
  const locations = locationsData ?? []

  const { data: workOrdersData } = useWorkOrders({ asset_id: assetId, per_page: 25 })
  const workOrders = workOrdersData?.work_orders ?? []

  const latestReadings = useRealtimeStore((s) => s.latestReadings[assetId])
  const deleteMutation = useDeleteAsset()

  const [activeTab, setActiveTab] = useState('overview')

  const handleDelete = async () => {
    if (!asset || !confirm(t('assets.detail.delete_confirm', { name: asset.name }))) return
    await deleteMutation.mutateAsync(asset.id)
    navigate('/assets')
  }

  const handleCopyTag = () => {
    if (asset) navigator.clipboard?.writeText(asset.asset_tag)
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (error || !asset) {
    return (
      <div className="py-12 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('assets.detail.not_found')}</p>
        <Button variant="link" asChild className="mt-4">
          <Link to="/assets">{t('assets.detail.back_to_assets')}</Link>
        </Button>
      </div>
    )
  }

  // Build timeline from work orders
  const timelineEvents: TimelineEvent[] = workOrders.map((wo) => ({
    id: wo.id,
    type: 'work_order' as const,
    title: `${wo.work_order_number} — ${wo.title}`,
    description: t('assets.detail.timeline_description', { status: word('status', wo.status).toLowerCase(), priority: word('priority', wo.priority).toLowerCase() }),
    date: wo.updated_at,
    meta: wo.actual_hours ? `${wo.actual_hours}h` : undefined,
  }))

  const latestReadingsArr = latestReadings
    ? Object.entries(latestReadings).map(([, reading]) => reading)
    : []

  return (
    <div className="space-y-4">
      {/* Back + header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link to="/assets">
              <ArrowLeft className="h-4 w-4" />
              {t('assets.detail.assets')}
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{asset.name}</h1>
            <button
              onClick={handleCopyTag}
              className="flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-sm text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
              title={t('assets.detail.click_to_copy')}
            >
              {asset.asset_tag}
              <Copy className="h-3 w-3" />
            </button>
            {canManage ? (
              <AssetStatusChanger asset={asset} />
            ) : (
              <AssetStatusBadge status={asset.status} />
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/work-orders?asset_id=${assetId}`)}>
            <ClipboardList className="h-4 w-4" />
            {t('assets.detail.new_wo')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => navigate(`/assets/print-labels?ids=${assetId}`)}>
            <Printer className="h-4 w-4" />
            {t('assets.detail.print_qr')}
          </Button>
          {canManage && (
            <Button size="sm" onClick={() => navigate(`/assets/${assetId}/edit`)}>
              <Pencil className="h-4 w-4" />
              {t('assets.detail.edit')}
            </Button>
          )}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button size="icon" variant="outline" aria-label={t('assets.detail.more_actions')}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-[200px] rounded-md border border-gray-200 bg-white py-1 shadow-md dark:border-gray-700 dark:bg-gray-800"
                sideOffset={4}
                align="end"
              >
                {isAdmin && (
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={handleDelete}
                  >
                    {t('assets.detail.delete_asset')}
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <InfoCard icon={MapPin} label={t('assets.detail.info_location')}>
          <LocationBreadcrumb
            locations={locations}
            locationId={asset.location_id}
            compact
          />
          {!asset.location_id && <span className="text-gray-500 dark:text-gray-400">—</span>}
        </InfoCard>
        <InfoCard icon={Hash} label={t('assets.detail.info_serial')}>
          {asset.serial_number ?? '—'}
        </InfoCard>
        <InfoCard icon={ClipboardList} label={t('assets.detail.info_open_wos')}>
          {asset.open_work_orders_count ?? 0}
        </InfoCard>
        <InfoCard icon={Wrench} label={t('assets.detail.info_last_service')}>
          {asset.last_work_order_date
            ? timeAgo(asset.last_work_order_date)
            : '—'}
        </InfoCard>
      </div>

      {asset.warranty_expires_on && <WarrantyNote endsOn={asset.warranty_expires_on} />}

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
        <Tabs.List className="flex border-b border-gray-200 dark:border-gray-700">
          {['overview', 'work-orders', 'meters', 'downtime', 'documents', 'history', 'iot-data', 'details'].map((tab) => (
            <Tabs.Trigger
              key={tab}
              value={tab}
              className="px-4 py-2 text-sm font-medium capitalize text-gray-500 transition-colors hover:text-gray-700 data-[state=active]:border-b-2 data-[state=active]:border-brand-600 data-[state=active]:text-brand-600 dark:text-gray-400 dark:hover:text-gray-200 dark:data-[state=active]:text-brand-400"
            >
              {t(`assets.detail.tab.${tab.replace(/-/g, '_')}`)}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Overview */}
        <Tabs.Content value="overview" className="pt-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4">
              <Card>
                <CardContent className="p-4">
                  <CardTitle className="mb-3">{t('assets.detail.asset_information')}</CardTitle>
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    {[
                      ['name', asset.name],
                      ['asset_tag', asset.asset_tag],
                      ['serial', asset.serial_number],
                      ['barcode', asset.barcode],
                      ['manufacturer', asset.manufacturer],
                      ['model', asset.model],
                      ['year', asset.year_manufactured],
                      ['status', asset.status],
                      ['purchase_date', asset.purchase_date ? formatDate(new Date(asset.purchase_date)) : null],
                      ['warranty_expiry', asset.warranty_expires_on ? formatDate(asset.warranty_expires_on) : null],
                    ].map(([field, value]) =>
                      value != null ? (
                        <div key={field as string}>
                          <dt className="text-xs text-gray-500 dark:text-gray-400">{t(`assets.detail.field.${field}`)}</dt>
                          <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">
                            {field === 'status' ? (
                              <AssetStatusBadge status={asset.status} />
                            ) : (
                              String(value)
                            )}
                          </dd>
                        </div>
                      ) : null,
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* Custom fields */}
              {asset.custom_fields && Object.keys(asset.custom_fields).length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <CardTitle className="mb-3">{t('assets.detail.custom_fields')}</CardTitle>
                    <dl className="grid grid-cols-2 gap-3 text-sm">
                      {Object.entries(asset.custom_fields).map(([key, val]) => (
                        <div key={key}>
                          <dt className="text-xs capitalize text-gray-500 dark:text-gray-400">
                            {key.replace(/_/g, ' ')}
                          </dt>
                          <dd className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">{String(val)}</dd>
                        </div>
                      ))}
                    </dl>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="space-y-4">
              <Card>
                <CardContent className="p-4 flex flex-col items-center">
                  <CardTitle className="mb-3 w-full">{t('assets.detail.qr_code')}</CardTitle>
                  <AssetQRCode
                    assetId={asset.id}
                    assetTag={asset.asset_tag}
                    assetName={asset.name}
                    publicCode={asset.public_code}
                    size="md"
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        </Tabs.Content>

        {/* Work Orders */}
        <Tabs.Content value="work-orders" className="pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-medium text-gray-900 dark:text-gray-100">{t('assets.detail.work_orders')}</h3>
            <Button size="sm" onClick={() => navigate(`/work-orders/new?asset_id=${assetId}`)}>
              <ClipboardList className="h-4 w-4" />
              {t('assets.detail.new_work_order')}
            </Button>
          </div>
          {workOrders.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">{t('assets.detail.no_work_orders')}</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    {['number', 'title', 'status', 'priority', 'due'].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        {t(`assets.detail.wo_col_${h}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                  {workOrders.map((wo) => (
                    <tr
                      key={wo.id}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      onClick={() => navigate(`/work-orders/${wo.id}`)}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">{wo.work_order_number}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{wo.title}</td>
                      <td className="px-4 py-3">
                        <Badge variant={statusBadge(wo.status)} className="capitalize">
                          {word('status', wo.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={priorityBadge(wo.priority)} className="capitalize">
                          {word('priority', wo.priority)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        {wo.due_date ? formatDate(new Date(wo.due_date)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Tabs.Content>

        {/* Maintenance History */}
        <Tabs.Content value="history" className="pt-4">
          <AssetTimeline events={timelineEvents} />
        </Tabs.Content>

        {/* Downtime */}
        <Tabs.Content value="downtime" className="pt-4">
          <AssetDowntime assetId={asset.id} canManage={canManage} />
        </Tabs.Content>

        {/* Documents */}
        <Tabs.Content value="documents" className="pt-4">
          <AssetDocuments assetId={asset.id} canManage={canManage} userId={user?.id} />
        </Tabs.Content>

        {/* Meters */}
        <Tabs.Content value="meters" className="pt-4">
          <AssetMeters assetId={asset.id} canManage={canManage} />
        </Tabs.Content>

        {/* IoT Data */}
        <Tabs.Content value="iot-data" className="pt-4">
          {latestReadingsArr.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {t('assets.detail.no_iot')}
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {latestReadingsArr.map((reading) => (
                  <SensorReadingCard
                    key={reading.id}
                    sensorType={reading.sensor_type}
                    value={reading.value}
                    unit={reading.unit}
                    recordedAt={reading.recorded_at}
                  />
                ))}
              </div>
              <SensorChart readings={latestReadingsArr} />
            </div>
          )}
        </Tabs.Content>

        {/* Details */}
        <Tabs.Content value="details" className="pt-4">
          <Card>
            <CardContent className="p-4">
              <CardTitle className="mb-3">{t('assets.detail.all_details')}</CardTitle>
              <dl className="space-y-2 text-sm">
                {[
                  ['asset_id', asset.id],
                  ['name', asset.name],
                  ['asset_tag', asset.asset_tag],
                  ['status', word('status', asset.status)],
                  ['serial', asset.serial_number ?? '—'],
                  ['barcode', asset.barcode ?? '—'],
                  ['manufacturer', asset.manufacturer ?? '—'],
                  ['model', asset.model ?? '—'],
                  ['year', asset.year_manufactured ?? '—'],
                  ['description', asset.description ?? '—'],
                  ['created', formatDateTime(asset.created_at)],
                  ['updated', formatDateTime(asset.updated_at)],
                ].map(([field, value]) => (
                  <div key={field as string} className="flex gap-4">
                    <dt className="w-36 shrink-0 text-gray-500 dark:text-gray-400">{t(`assets.detail.field.${field}`)}</dt>
                    <dd className="flex-1 text-gray-900 dark:text-gray-100">{String(value)}</dd>
                  </div>
                ))}
              </dl>
            </CardContent>
          </Card>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  )
}
