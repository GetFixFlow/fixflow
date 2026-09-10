import { IoTRuleForm } from '@/components/iot/IoTRuleForm'
import { useCreateIotRule } from '@/hooks/useIoT'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export function IoTRuleCreatePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const assetId = params.get('asset_id') ? Number(params.get('asset_id')) : undefined
  const createRule = useCreateIotRule()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/iot/rules" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New IoT Rule</h1>
      </div>
      <IoTRuleForm
        defaultValues={assetId ? { asset_id: assetId } : undefined}
        mode="create"
        isLoading={createRule.isPending}
        onSubmit={async (data) => {
          await createRule.mutateAsync(data, { onSuccess: () => navigate('/iot/rules') })
        }}
      />
    </div>
  )
}
