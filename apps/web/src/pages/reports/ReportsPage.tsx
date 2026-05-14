import { BarChart3 } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Analytics and performance reports" />
      <EmptyState
        icon={BarChart3}
        title="Reports coming soon"
        description="Advanced reporting features are available via the API."
      />
    </div>
  )
}
