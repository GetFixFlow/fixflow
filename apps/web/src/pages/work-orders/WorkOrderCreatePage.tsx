import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { WorkOrderForm, type WorkOrderFormValues } from '@/components/work-orders/WorkOrderForm'
import { useCreateWorkOrder } from '@/hooks/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'

export function WorkOrderCreatePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const lockedAssetId = searchParams.get('asset_id')
    ? Number(searchParams.get('asset_id'))
    : undefined

  const { user } = useAuthStore()
  const createWO = useCreateWorkOrder()

  const handleSubmit = async (values: WorkOrderFormValues) => {
    const res = await createWO.mutateAsync({
      title: values.title,
      description: values.description,
      priority: values.priority,
      asset_id: values.asset_id,
      due_date: values.due_date,
      estimated_hours: values.estimated_hours,
      source: 'manual',
      requester_id: user?.id,
    })
    navigate(`/work-orders/${res.data.data.id}`)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center gap-2">
        <Link
          to="/work-orders"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Work Orders
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New Work Order</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Fill in the details to create a new work order.
        </p>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800">
        <WorkOrderForm
          onSubmit={handleSubmit}
          isLoading={createWO.isPending}
          mode="create"
          lockedAssetId={lockedAssetId}
          onCancel={() => navigate('/work-orders')}
        />
      </div>
    </div>
  )
}
