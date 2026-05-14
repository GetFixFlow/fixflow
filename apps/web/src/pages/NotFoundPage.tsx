import { useNavigate } from 'react-router-dom'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="mb-4 flex justify-center">
          <div className="rounded-full bg-gray-100 p-6 dark:bg-gray-700">
            <FileQuestion className="h-12 w-12 text-gray-400" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">404</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Page not found</p>
        <Button className="mt-6" onClick={() => navigate('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    </div>
  )
}
