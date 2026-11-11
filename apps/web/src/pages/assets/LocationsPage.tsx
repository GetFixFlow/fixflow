import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus, MapPin, Building2, Package, ClipboardList } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import { Button } from '@/components/ui/Button'
import { Badge, statusBadge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { LocationTree, LocationTreeSkeleton } from '@/components/shared/LocationTree'
import { LocationBreadcrumb } from '@/components/shared/LocationBreadcrumb'
import { LocationFormModal } from '@/components/locations/LocationFormModal'
import { DeleteLocationModal } from '@/components/locations/DeleteLocationModal'
import { useLocations } from '@/hooks/useLocations'
import { useAssets } from '@/hooks/useAssets'
import { useAuthStore } from '@/stores/authStore'
import type { Location } from '@/types'
import { formatDate } from '@/lib/localeFormat'
import { label } from '@/i18n'

export function LocationsPage() {
  const { t } = useTranslation()
  const typeText = (type: string) => t(`assets.locations.type.${type}`, { defaultValue: type })
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const canManage = user?.role === 'admin' || user?.role === 'manager'

  const { data: locations = [], isLoading } = useLocations()

  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editLocation, setEditLocation] = useState<Location | null>(null)
  const [deleteLocation, setDeleteLocation] = useState<Location | null>(null)
  const [defaultParentId, setDefaultParentId] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState('assets')

  const { data: assetsData } = useAssets(
    selectedLocation ? { location_id: selectedLocation.id } : undefined,
  )
  const locationAssets = assetsData?.assets ?? []

  const childLocations = selectedLocation
    ? locations.filter((l) => l.parent_id === selectedLocation.id)
    : []

  const handleAddChild = (parent: Location) => {
    setDefaultParentId(parent.id)
    setEditLocation(null)
    setFormOpen(true)
  }

  const handleEdit = (loc: Location) => {
    setEditLocation(loc)
    setDefaultParentId(null)
    setFormOpen(true)
  }

  const handleDelete = (loc: Location) => {
    setDeleteLocation(loc)
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left panel */}
      <div className="flex w-80 shrink-0 flex-col border-r border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">{t('assets.locations.title')}</h2>
          {canManage && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => navigate('/import?kind=locations')} aria-label={t('assets.locations.import_aria')}>
                {t('assets.locations.import')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setEditLocation(null)
                  setDefaultParentId(null)
                  setFormOpen(true)
                }}
              >
                <Plus className="h-4 w-4" />
                {t('assets.locations.add')}
              </Button>
            </div>
          )}
        </div>

        {isLoading ? (
          <LocationTreeSkeleton />
        ) : (
          <div className="flex-1 overflow-auto">
            <LocationTree
              locations={locations}
              selectedId={selectedLocation?.id}
              onSelect={setSelectedLocation}
              searchable
              showAssetCount
              expandedByDefault
              onAddChild={canManage ? handleAddChild : undefined}
              onEdit={canManage ? handleEdit : undefined}
              onDelete={canManage ? handleDelete : undefined}
            />
          </div>
        )}
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-auto">
        {!selectedLocation ? (
          <div className="flex h-full items-center justify-center">
            <EmptyState
              icon={MapPin}
              title={t('assets.locations.select_title')}
              description={t('assets.locations.select_description')}
            />
          </div>
        ) : (
          <div className="space-y-4 p-6">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {selectedLocation.name}
                  </h1>
                  <Badge variant="secondary" className="capitalize">
                    {typeText(selectedLocation.location_type)}
                  </Badge>
                </div>
                <LocationBreadcrumb
                  locations={locations}
                  locationId={selectedLocation.id}
                  className="mt-1"
                />
              </div>
              {canManage && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleEdit(selectedLocation)}
                  >
                    {t('assets.locations.edit')}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(selectedLocation)}
                  >
                    {t('assets.locations.delete')}
                  </Button>
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-8 w-8 rounded-lg bg-blue-100 p-1.5 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400" />
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {childLocations.length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('assets.locations.sub_locations')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 rounded-lg bg-green-100 p-1.5 text-green-600 dark:bg-green-900/40 dark:text-green-400" />
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {selectedLocation.asset_count ?? locationAssets.length}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('assets.locations.assets')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <ClipboardList className="h-8 w-8 rounded-lg bg-orange-100 p-1.5 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400" />
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">—</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t('assets.locations.open_wos')}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs.Root value={activeTab} onValueChange={setActiveTab}>
              <Tabs.List className="flex border-b border-gray-200 dark:border-gray-700">
                {['assets', 'sub_locations', 'details'].map((tab) => (
                  <Tabs.Trigger
                    key={tab}
                    value={tab}
                    className="px-4 py-2 text-sm font-medium capitalize text-gray-500 transition-colors hover:text-gray-700 data-[state=active]:border-b-2 data-[state=active]:border-brand-600 data-[state=active]:text-brand-600 dark:text-gray-400 dark:hover:text-gray-200 dark:data-[state=active]:text-brand-400"
                  >
                    {t(`assets.locations.tab.${tab}`)}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>

              <Tabs.Content value="assets" className="pt-4">
                {locationAssets.length === 0 ? (
                  <EmptyState
                    icon={Package}
                    title={t('assets.locations.no_assets_title')}
                    description={t('assets.locations.no_assets_description')}
                    action={
                      canManage
                        ? { label: t('assets.locations.add_asset'), onClick: () => navigate('/assets/new') }
                        : undefined
                    }
                  />
                ) : (
                  <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-700/50">
                        <tr>
                          {['name', 'tag', 'status', 'last_maintenance'].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400"
                            >
                              {t(`assets.locations.col_${h}`)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white dark:divide-gray-700 dark:bg-gray-800">
                        {locationAssets.map((asset) => (
                          <tr
                            key={asset.id}
                            className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                            onClick={() => navigate(`/assets/${asset.id}`)}
                          >
                            <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                              {asset.name}
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-gray-400">
                              {asset.asset_tag}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={statusBadge(asset.status)} className="capitalize">
                                {label('status', asset.status)}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                              {asset.last_work_order_date
                                ? formatDate(asset.last_work_order_date)
                                : '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Tabs.Content>

              <Tabs.Content value="sub-locations" className="pt-4">
                {childLocations.length === 0 ? (
                  <EmptyState
                    icon={Building2}
                    title={t('assets.locations.no_sub_title')}
                    description={t('assets.locations.no_sub_description')}
                    action={
                      canManage
                        ? {
                            label: t('assets.locations.add_sub'),
                            onClick: () => handleAddChild(selectedLocation),
                          }
                        : undefined
                    }
                  />
                ) : (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {childLocations.map((child) => (
                      <Card
                        key={child.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => setSelectedLocation(child)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900 dark:text-gray-100">
                              {child.name}
                            </p>
                            <Badge variant="secondary" className="capitalize text-xs">
                              {typeText(child.location_type)}
                            </Badge>
                          </div>
                          {child.asset_count != null && child.asset_count > 0 && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              {t('assets.locations.asset_count', { count: child.asset_count })}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </Tabs.Content>

              <Tabs.Content value="details" className="pt-4">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">{t('assets.locations.full_path')}</p>
                        <LocationBreadcrumb
                          locations={locations}
                          locationId={selectedLocation.id}
                          className="mt-0.5"
                        />
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">{t('assets.locations.type_label')}</p>
                        <p className="mt-0.5 font-medium capitalize text-gray-900 dark:text-gray-100">
                          {typeText(selectedLocation.location_type)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 dark:text-gray-400">{t('assets.locations.created')}</p>
                        <p className="mt-0.5 font-medium text-gray-900 dark:text-gray-100">
                          {formatDate(selectedLocation.created_at)}
                        </p>
                      </div>
                      {selectedLocation.description && (
                        <div className="col-span-2">
                          <p className="text-gray-500 dark:text-gray-400">{t('assets.locations.description')}</p>
                          <p className="mt-0.5 text-gray-900 dark:text-gray-100">
                            {selectedLocation.description}
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Tabs.Content>
            </Tabs.Root>
          </div>
        )}
      </div>

      {/* Modals */}
      <LocationFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditLocation(null) }}
        locations={locations}
        location={editLocation}
        defaultParentId={defaultParentId}
      />
      <DeleteLocationModal
        open={!!deleteLocation}
        onClose={() => setDeleteLocation(null)}
        location={deleteLocation}
      />
    </div>
  )
}
