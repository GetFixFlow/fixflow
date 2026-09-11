import { Sparkles } from 'lucide-react'
import { Button, type ButtonProps } from '@/components/ui/Button'
import { useAI } from '@/hooks/useAI'
import { cn } from '@/lib/utils'

export function AIButton({ className, children, ...props }: ButtonProps) {
  const { enabled, isLoading } = useAI()

  if (isLoading) return null
  if (!enabled) return null

  return (
    <Button
      variant="outline"
      className={cn(
        'rounded-full border-blue-200 bg-white text-blue-600 font-medium shadow-sm hover:bg-blue-50 hover:border-blue-300 dark:border-blue-800 dark:bg-transparent dark:text-blue-400 dark:hover:bg-blue-900/20',
        className,
      )}
      title="AI feature — requires API key in settings"
      {...props}
    >
      <Sparkles className="h-4 w-4 text-blue-500 dark:text-blue-400" />
      {children}
    </Button>
  )
}
