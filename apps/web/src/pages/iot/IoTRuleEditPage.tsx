import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { IoTRuleForm } from '@/components/iot/IoTRuleForm'
import { useIotRule, useUpdateIotRule } from '@/hooks/useIoT'
import { Skeleton } from '@/components/ui/Skeleton'

export function IoTRuleEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const ruleId = Number(id)
  const { data, isLoading } = useIotRule(ruleId)
  const updateRule = useUpdateIotRule(ruleId)
  const rule = data?.data

  if (isLoading) return <div className="space-y-4">{Array.from({length:4}).map((_,i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
  if (!rule) return <div className="text-center py-20 text-gray-500">Rule not found</div>

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/iot/rules" className="text-gray-400 hover:text-gray-600"><ArrowLeft className="h-5 w-5" /></Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit IoT Rule</h1>
      </div>
      <IoTRuleForm
        defaultValues={rule}
        mode="edit"
        isLoading={updateRule.isPending}
        onSubmit={async (data) => {
          await updateRule.mutateAsync(data, { onSuccess: () => navigate('/iot/rules') })
        }}
      />
    </div>
  )
}
