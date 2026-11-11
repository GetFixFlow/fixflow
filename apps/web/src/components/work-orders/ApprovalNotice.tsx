import { useTranslation } from 'react-i18next'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useApproval } from '@/hooks/useWorkOrders'
import { formatDate, formatMoney } from '@/lib/localeFormat'
import type { WorkOrder } from '@/types'

interface ApprovalNoticeProps {
  wo: WorkOrder
  userId?: number
  isManager: boolean
}

/**
 * Work over the company's approval limit cannot be started, or completed once it has cost more, until a manager approves
 * it. Says so to everyone; gives the managers the cost and the button, and the person doing the work a way to ask.
 */
export function ApprovalNotice({ wo, userId, isManager }: ApprovalNoticeProps) {
  const { t } = useTranslation()
  const { approve, request } = useApproval()
  const mine = wo.assignee_id === userId
  const canApprove = isManager && !mine

  if (!wo.approval_needed) {
    if (!wo.approved_by || !wo.approved_at) return null
    return (
      <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <ShieldCheck className="h-4 w-4 text-green-700 dark:text-green-400" aria-hidden />
        {wo.approved_cost != null
          ? t('workOrders.approval.approved_cost', { name: wo.approved_by.full_name, date: formatDate(wo.approved_at), cost: formatMoney(wo.approved_cost) })
          : t('workOrders.approval.approved', { name: wo.approved_by.full_name, date: formatDate(wo.approved_at) })}
      </p>
    )
  }

  const next = wo.status === 'in_progress' ? 'completed' : 'started'
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">{t(`workOrders.approval.needs_${next}`)}</p>
          <p>
            {t('workOrders.approval.limit', { expected: isManager && wo.expected_cost != null ? t('workOrders.approval.expected', { cost: formatMoney(wo.expected_cost) }) : '' })}
            {wo.approval_requested_at && ` ${t('workOrders.approval.asked', { date: formatDate(wo.approval_requested_at) })}`}
          </p>
          {isManager && mine && <p>{t('workOrders.approval.another')}</p>}
        </div>
      </div>
      {canApprove && (
        <Button size="sm" onClick={() => approve.mutate(wo.id)} loading={approve.isPending}>{t('workOrders.approval.approve')}</Button>
      )}
      {!canApprove && mine && !wo.approval_requested_at && (
        <Button size="sm" variant="outline" onClick={() => request.mutate(wo.id)} loading={request.isPending}>{t('workOrders.approval.ask')}</Button>
      )}
    </div>
  )
}
