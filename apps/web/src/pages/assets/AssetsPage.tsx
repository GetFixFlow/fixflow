import { Package } from 'lucide-react'
import { useAssets } from '@/hooks/useAssets'
import { PageHeader } from '@/components/ui/PageHeader'
import { Badge, statusBadge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'

export function AssetsPage() {
  const { data, isLoading } = useAssets()
  const assets = data?.assets ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assets"
        description="Manage your equipment and facilities"
        actions={<Button>Add Asset</Button>}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No assets yet"
          description="Add your first asset to start tracking maintenance."
          action={{ label: 'Add Asset', onClick: () => {} }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assets.map((asset) => (
            <Card key={asset.id} className="hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{asset.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{asset.asset_tag}</p>
                    {asset.category && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{asset.category}</p>
                    )}
                  </div>
                  <Badge variant={statusBadge(asset.status)}>{asset.status}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
