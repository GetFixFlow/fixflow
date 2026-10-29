import { useNavigate } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { TwoFactorCard } from '@/components/security/TwoFactorCard'
import { useLogout } from '@/hooks/useAuth'

/**
 * Shown, with nothing else, to a person whose company requires two-factor sign-in and who has not set it up (see
 * ProtectedRoute): the rest of the app would refuse them anyway.
 */
export function TwoFactorSetupPage() {
  const navigate = useNavigate()
  const { mutate: logout } = useLogout()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8 dark:bg-gray-900">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-brand-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Set up two-factor sign-in</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Your company requires it. It takes a minute, and you need your phone.</p>
          </div>
        </div>
        <TwoFactorCard onEnabled={() => navigate('/dashboard', { replace: true })} />
        <p className="text-center text-sm">
          <button type="button" className="text-brand-600 hover:underline" onClick={() => logout()}>Sign out</button>
        </p>
      </div>
    </div>
  )
}
