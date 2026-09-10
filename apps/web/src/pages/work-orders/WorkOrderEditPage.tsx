import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { WorkOrderForm, type WorkOrderFormValues } from '@/components/work-orders/WorkOrderForm'
import { useWorkOrder, useUpdateWorkOrder } from '@/hooks/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'
import { Skeleton } from '@/components/ui/Skeleton'

export function WorkOrderEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: wo, isLoading } = useWorkOrder(Number(id))
  const update = useUpdateWorkOrder(Number(id))

  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const isAssignedToMe = wo?.assignee_id === user?.id
  const canEdit = isManager || (isAssignedToMe && ['open', 'assigned', 'in_progress'].includes(wo?.status ?? ''))

  const handleSubmit = async (values: WorkOrderFormValues) => {
    await update.mutateAsync({
      title: values.title,
      description: values.description,
      priority: values.priority,
      asset_id: values.asset_id,
      due_date: values.due_date,
      estimated_hours: values.estimated_hours,
    })
    navigate(`/work-orders/${id}`)
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!wo) {
    return (
      <p className="text-center text-gray-500">Work order not found.</p>
    )
  }

  if (!canEdit || ['verified', 'cancelled'].includes(wo.status)) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800">
        <p className="text-gray-600 dark:text-gray-400">
          This work order cannot be edited{' '}
          {wo.status === 'verified' ? '(already verified)' : wo.status === 'cancelled' ? '(cancelled)' : '(no permission)'}.
        </p>
        <Link
          to={`/work-orders/${id}`}
          className="mt-3 inline-block text-sm text-brand-600 hover:underline dark:text-brand-400"
        >
          Back to work order
        </Link>
      </div>
    )
  }

  const defaultValues: Partial<WorkOrderFormValues> = {
    title: wo.title,
    description: wo.description,
    priority: wo.priority,
    asset_id: wo.asset_id ?? undefined,
    due_date: wo.due_date?.slice(0, 16),
    estimated_hours: wo.estimated_hours,
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to={`/work-orders/${id}`}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {wo.work_order_number}
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Work Order</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{wo.work_order_number}</p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <WorkOrderForm
          defaultValues={defaultValues}
          onSubmit={handleSubmit}
          isLoading={update.isPending}
          mode="edit"
          onCancel={() => navigate(`/work-orders/${id}`)}
        />
      </div>
    </div>
  )
}
