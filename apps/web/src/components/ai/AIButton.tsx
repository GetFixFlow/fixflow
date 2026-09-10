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
      className={cn('border-brand-300 text-brand-700 hover:bg-brand-50 dark:border-brand-700 dark:text-brand-300 dark:hover:bg-brand-900/20', className)}
      title="AI feature — requires API key in settings"
      {...props}
    >
      <Sparkles className="h-4 w-4" />
      {children}
    </Button>
  )
}
