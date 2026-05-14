import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200',
        secondary: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
        success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        destructive: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        outline: 'border border-current text-gray-700 dark:text-gray-300',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export function priorityBadge(priority: string) {
  const map: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    low: 'secondary',
    medium: 'default',
    high: 'warning',
    critical: 'destructive',
  }
  return map[priority] ?? 'secondary'
}

export function statusBadge(status: string) {
  const map: Record<string, VariantProps<typeof badgeVariants>['variant']> = {
    open: 'default',
    assigned: 'default',
    in_progress: 'warning',
    on_hold: 'secondary',
    completed: 'success',
    verified: 'success',
    cancelled: 'outline',
    operational: 'success',
    maintenance: 'warning',
    offline: 'destructive',
    retired: 'secondary',
  }
  return map[status] ?? 'secondary'
}
