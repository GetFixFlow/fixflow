import { Settings } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { PageHeader } from '@/components/ui/PageHeader'

export function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Organization and account settings" />
      <EmptyState
        icon={Settings}
        title="Settings"
        description="Organization settings and API key management coming soon."
      />
    </div>
  )
}
