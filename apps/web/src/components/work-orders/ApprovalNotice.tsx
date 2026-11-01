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
  const { approve, request } = useApproval()
  const mine = wo.assignee_id === userId
  const canApprove = isManager && !mine

  if (!wo.approval_needed) {
    if (!wo.approved_by || !wo.approved_at) return null
    return (
      <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <ShieldCheck className="h-4 w-4 text-green-600" aria-hidden />
        Approved by {wo.approved_by.full_name} on {formatDate(wo.approved_at)}
        {wo.approved_cost != null && ` for a cost of up to ${formatMoney(wo.approved_cost)}`}.
      </p>
    )
  }

  const next = wo.status === 'in_progress' ? 'completed' : 'started'
  return (
    <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-200">
      <div className="flex items-start gap-2">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <div>
          <p className="font-medium">Needs a manager&apos;s approval before it can be {next}.</p>
          <p>
            It costs more than the company&apos;s approval limit
            {isManager && wo.expected_cost != null && ` (expected ${formatMoney(wo.expected_cost)})`}.
            {wo.approval_requested_at && ` The managers were asked on ${formatDate(wo.approval_requested_at)}.`}
          </p>
          {isManager && mine && <p>Another manager has to approve work you are doing yourself.</p>}
        </div>
      </div>
      {canApprove && (
        <Button size="sm" onClick={() => approve.mutate(wo.id)} loading={approve.isPending}>Approve</Button>
      )}
      {!canApprove && mine && !wo.approval_requested_at && (
        <Button size="sm" variant="outline" onClick={() => request.mutate(wo.id)} loading={request.isPending}>Ask a manager</Button>
      )}
    </div>
  )
}
