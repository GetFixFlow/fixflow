import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardContent } from '@/components/ui/Card'
import { TwoFactorCard } from '@/components/security/TwoFactorCard'

export function SecurityPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Security" description="How you sign in to your account" />

      <TwoFactorCard />

      <Card>
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Where you are signed in</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              The browsers and phones signed in to your account, with when each was last used, and a way to sign any of them out. Your
              password is changed there too.
            </p>
          </div>
          <Link to="/settings/profile" className="shrink-0 text-sm text-brand-600 hover:underline">Open My Profile →</Link>
        </CardContent>
      </Card>
    </div>
  )
}
