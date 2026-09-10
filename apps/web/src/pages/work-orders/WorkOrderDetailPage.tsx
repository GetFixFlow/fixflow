import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  MoreHorizontal,
  Copy,
  Check,
  Edit,
  Clock,
  User,
  Calendar,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import * as Tabs from '@radix-ui/react-tabs'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useWorkOrder, useTransitionWorkOrder, useUpdateWorkOrder } from '@/hooks/useWorkOrders'
import { useAuthStore } from '@/stores/authStore'
import { WorkOrderStatusBadge } from '@/components/work-orders/WorkOrderStatusBadge'
import { WorkOrderPriorityBadge } from '@/components/work-orders/WorkOrderPriorityBadge'
import { WorkOrderSourceBadge } from '@/components/work-orders/WorkOrderSourceBadge'
import { WorkOrderDueDate } from '@/components/work-orders/WorkOrderDueDate'
import { WorkOrderTimeline } from '@/components/work-orders/WorkOrderTimeline'
import { WorkOrderChecklist } from '@/components/work-orders/WorkOrderChecklist'
import { WorkOrderComments } from '@/components/work-orders/WorkOrderComments'
import { WorkOrderAttachments } from '@/components/work-orders/WorkOrderAttachments'
import { WorkOrderPartsLog } from '@/components/work-orders/WorkOrderPartsLog'
import { WorkOrderActivityLog } from '@/components/work-orders/WorkOrderActivityLog'
import { WorkOrderCosts } from '@/components/work-orders/WorkOrderCosts'
import { WorkOrderRelated } from '@/components/work-orders/WorkOrderRelated'
import { AssignModal } from '@/components/work-orders/modals/AssignModal'
import { CompleteModal } from '@/components/work-orders/modals/CompleteModal'
import { RejectModal } from '@/components/work-orders/modals/RejectModal'
import { HoldModal } from '@/components/work-orders/modals/HoldModal'
import { CancelModal } from '@/components/work-orders/modals/CancelModal'
import { VerifyModal } from '@/components/work-orders/modals/VerifyModal'
import { PartLogModal } from '@/components/work-orders/modals/PartLogModal'
import { AIButton } from '@/components/ai/AIButton'
import { FixFlowAssistDrawer } from '@/components/ai/FixFlowAssistDrawer'
import type { ActivityEvent } from '@/components/work-orders/WorkOrderActivityLog'

type ModalId = 'assign' | 'complete' | 'reject' | 'hold' | 'cancel' | 'verify' | 'part_log' | null

function CopyId({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {})
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
      className="flex items-center gap-1 font-mono text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
      aria-label={`Copy ${text}`}
    >
      {text}
      {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export function WorkOrderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: wo, isLoading, isError } = useWorkOrder(Number(id))
  const transition = useTransitionWorkOrder()
  const updateWO = useUpdateWorkOrder(Number(id))
  const [openModal, setOpenModal] = useState<ModalId>(null)
  const [assistOpen, setAssistOpen] = useState(false)

  const isManager = user?.role === 'admin' || user?.role === 'manager'
  const isAssignedToMe = wo?.assignee_id === user?.id
  const canManage = isManager

  // Derive activity events from work order state
  const activityEvents: ActivityEvent[] = []
  if (wo) {
    activityEvents.push({
      id: 0,
      type: 'created',
      description: 'created this work order',
      actor_name: wo.requester?.full_name ?? 'Unknown',
      created_at: wo.created_at,
    })
    if (wo.assignee && wo.status !== 'open') {
      activityEvents.push({
        id: 1,
        type: 'assigned',
        description: `assigned to ${wo.assignee.full_name}`,
        actor_name: wo.requester?.full_name ?? 'Manager',
        created_at: wo.updated_at,
      })
    }
    if (wo.started_at) {
      activityEvents.push({
        id: 2,
        type: 'started',
        description: 'started work',
        actor_name: wo.assignee?.full_name ?? 'Technician',
        created_at: wo.started_at,
      })
    }
    if (wo.completed_at) {
      activityEvents.push({
        id: 3,
        type: 'completed',
        description: 'marked as complete',
        actor_name: wo.assignee?.full_name ?? 'Technician',
        created_at: wo.completed_at,
      })
    }
    if (wo.verified_at) {
      activityEvents.push({
        id: 4,
        type: 'verified',
        description: 'verified and closed',
        actor_name: wo.verified_by?.full_name ?? 'Manager',
        created_at: wo.verified_at,
      })
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !wo) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          Work order not found or you don't have access.
        </p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/work-orders')}>
          Back to Work Orders
        </Button>
      </div>
    )
  }

  const isVerified = wo.status === 'verified'
  const isCancelled = wo.status === 'cancelled'
  const isReadOnly = isVerified || isCancelled

  return (
    <div className="space-y-4">
      {/* Top navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/work-orders"
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Work Orders
        </Link>

        <div className="flex items-center gap-2">
          <CopyId text={wo.work_order_number} />
          <WorkOrderPriorityBadge priority={wo.priority} />
          <WorkOrderStatusBadge status={wo.status} />
          <WorkOrderSourceBadge source={wo.source} showLabel={false} />

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="z-50 min-w-40 rounded-md border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                align="end"
              >
                {canManage && !isReadOnly && (
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center rounded px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                    onSelect={() => navigate(`/work-orders/${wo.id}/edit`)}
                  >
                    <Edit className="mr-2 h-4 w-4" /> Edit
                  </DropdownMenu.Item>
                )}
                {canManage && !isReadOnly && (
                  <DropdownMenu.Item
                    className="flex cursor-pointer items-center rounded px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onSelect={() => setOpenModal('cancel')}
                  >
                    Cancel
                  </DropdownMenu.Item>
                )}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      {/* Title */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{wo.title}</h1>
        <AIButton size="sm" onClick={() => setAssistOpen(true)}>
          Ask AI
        </AIButton>
      </div>

      {/* Action bar */}
      {!isReadOnly && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
          {wo.status === 'open' && !wo.assignee_id && user?.role === 'technician' && (
            <Button
              size="sm"
              onClick={() =>
                transition.mutate({ id: wo.id, event: 'assign_self' })
              }
            >
              Assign to Me
            </Button>
          )}
          {wo.status === 'open' && canManage && (
            <Button size="sm" onClick={() => setOpenModal('assign')}>
              Assign...
            </Button>
          )}
          {wo.status === 'assigned' && isAssignedToMe && (
            <Button
              size="sm"
              onClick={() => transition.mutate({ id: wo.id, event: 'start' })}
              loading={transition.isPending}
            >
              ▶ Start Work
            </Button>
          )}
          {wo.status === 'in_progress' && isAssignedToMe && (
            <>
              <Button size="sm" variant="outline" onClick={() => setOpenModal('hold')}>
                ⏸ Put On Hold
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  transition.mutate({ id: wo.id, event: 'pending_parts' })
                }
              >
                🔧 Need Parts
              </Button>
              <Button size="sm" onClick={() => setOpenModal('complete')}>
                ✓ Complete
              </Button>
            </>
          )}
          {(wo.status === 'on_hold' || wo.status === 'pending_parts') && isAssignedToMe && (
            <Button
              size="sm"
              onClick={() => transition.mutate({ id: wo.id, event: 'resume' })}
              loading={transition.isPending}
            >
              ▶ Resume
            </Button>
          )}
          {wo.status === 'completed' && canManage && wo.assignee_id !== user?.id && (
            <>
              <Button size="sm" onClick={() => setOpenModal('verify')}>
                ✓ Verify
              </Button>
              <Button size="sm" variant="outline" onClick={() => setOpenModal('reject')}>
                ↩ Reject
              </Button>
            </>
          )}
          {canManage && !['open'].includes(wo.status) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate(`/work-orders/${wo.id}/edit`)}
            >
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Button>
          )}
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column (2/3) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Timeline */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Progress
            </h2>
            <WorkOrderTimeline status={wo.status} />
          </section>

          {/* Description */}
          {wo.description && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Description
              </h2>
              <p className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-300">
                {wo.description}
              </p>
            </section>
          )}

          {/* Checklist */}
          {wo.checklist_items && wo.checklist_items.length > 0 && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-4 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Checklist
              </h2>
              <WorkOrderChecklist
                workOrderId={wo.id}
                items={wo.checklist_items}
                editable={!isReadOnly && isAssignedToMe}
              />
            </section>
          )}

          {/* Tabs: Comments, Attachments, Parts */}
          <Tabs.Root defaultValue="comments">
            <Tabs.List className="flex border-b border-gray-200 dark:border-gray-700">
              {['comments', 'attachments', 'parts'].map((tab) => (
                <Tabs.Trigger
                  key={tab}
                  value={tab}
                  className={cn(
                    'px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-colors',
                    'border-transparent text-gray-500 hover:text-gray-700 data-[state=active]:border-brand-600 data-[state=active]:text-brand-600',
                    'dark:text-gray-400 dark:hover:text-gray-200 dark:data-[state=active]:border-brand-400 dark:data-[state=active]:text-brand-400',
                  )}
                >
                  {tab.replace('_', ' ')}
                </Tabs.Trigger>
              ))}
            </Tabs.List>
            <div className="rounded-b-lg rounded-tr-lg border border-t-0 border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <Tabs.Content value="comments">
                <WorkOrderComments workOrderId={wo.id} canViewInternal={canManage} />
              </Tabs.Content>
              <Tabs.Content value="attachments">
                <WorkOrderAttachments
                  workOrderId={wo.id}
                  editable={!isReadOnly && (isAssignedToMe || canManage)}
                />
              </Tabs.Content>
              <Tabs.Content value="parts">
                <WorkOrderPartsLog
                  workOrderId={wo.id}
                  editable={!isReadOnly && isAssignedToMe}
                  onAddPart={() => setOpenModal('part_log')}
                />
              </Tabs.Content>
            </div>
          </Tabs.Root>
        </div>

        {/* Right column (1/3) */}
        <div className="space-y-4">
          {/* Asset */}
          {wo.asset && (
            <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
              <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                Asset
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">
                    {wo.asset.name}
                  </span>
                  <span className="font-mono text-xs text-gray-400">{wo.asset.asset_tag}</span>
                </div>
                <Link
                  to={`/assets/${wo.asset_id}`}
                  className="text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  View full asset details →
                </Link>
              </div>
            </section>
          )}

          {/* Details */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Details
            </h2>
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Requester</dt>
                <dd className="text-gray-900 dark:text-gray-100">
                  {wo.requester?.full_name ?? '—'}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Assignee</dt>
                <dd className="text-gray-900 dark:text-gray-100">
                  {wo.assignee?.full_name ?? (
                    <span className="italic text-gray-400">Unassigned</span>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Created</dt>
                <dd className="text-gray-900 dark:text-gray-100">
                  {formatDistanceToNow(new Date(wo.created_at), { addSuffix: true })}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Due Date</dt>
                <dd>
                  <WorkOrderDueDate dueDate={wo.due_date} />
                </dd>
              </div>
              {wo.started_at && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Started</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {format(new Date(wo.started_at), 'MMM d, HH:mm')}
                  </dd>
                </div>
              )}
              {wo.completed_at && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Completed</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {format(new Date(wo.completed_at), 'MMM d, HH:mm')}
                  </dd>
                </div>
              )}
              {wo.verified_at && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Verified by</dt>
                  <dd className="text-gray-900 dark:text-gray-100">
                    {wo.verified_by?.full_name} on{' '}
                    {format(new Date(wo.verified_at), 'MMM d')}
                  </dd>
                </div>
              )}
              {wo.estimated_hours && (
                <div className="flex items-center justify-between">
                  <dt className="text-gray-500 dark:text-gray-400">Est. Hours</dt>
                  <dd className="text-gray-900 dark:text-gray-100">{wo.estimated_hours} hrs</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt className="text-gray-500 dark:text-gray-400">Actual Hours</dt>
                <dd>
                  {isAssignedToMe && wo.status === 'in_progress' ? (
                    <input
                      type="number"
                      step="0.5"
                      defaultValue={wo.actual_hours ?? ''}
                      onBlur={(e) => {
                        const val = parseFloat(e.target.value)
                        if (!isNaN(val)) updateWO.mutate({ actual_hours: val })
                      }}
                      className="w-20 rounded border border-gray-300 px-2 py-0.5 text-sm focus:border-brand-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                    />
                  ) : (
                    <span className="text-gray-900 dark:text-gray-100">
                      {wo.actual_hours ? `${wo.actual_hours} hrs` : '—'}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          {/* Costs */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <WorkOrderCosts
              workOrderId={wo.id}
              actualHours={wo.actual_hours}
              laborCost={wo.labor_cost}
            />
          </section>

          {/* Related */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Related
            </h2>
            <WorkOrderRelated workOrder={wo} />
          </section>

          {/* Activity log */}
          <section className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
            <h2 className="mb-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
              Activity
            </h2>
            <WorkOrderActivityLog events={[...activityEvents].reverse()} compact />
          </section>
        </div>
      </div>

      {/* Modals */}
      <AssignModal
        workOrderId={wo.id}
        open={openModal === 'assign'}
        onClose={() => setOpenModal(null)}
      />
      <CompleteModal
        workOrderId={wo.id}
        checklistItems={wo.checklist_items}
        open={openModal === 'complete'}
        onClose={() => setOpenModal(null)}
      />
      <RejectModal
        workOrderId={wo.id}
        currentAssigneeId={wo.assignee_id}
        open={openModal === 'reject'}
        onClose={() => setOpenModal(null)}
      />
      <HoldModal
        workOrderId={wo.id}
        open={openModal === 'hold'}
        onClose={() => setOpenModal(null)}
      />
      <CancelModal
        workOrderId={wo.id}
        open={openModal === 'cancel'}
        onClose={() => setOpenModal(null)}
      />
      <VerifyModal
        workOrder={wo}
        open={openModal === 'verify'}
        onClose={() => setOpenModal(null)}
        onReject={() => {
          setOpenModal(null)
          setTimeout(() => setOpenModal('reject'), 50)
        }}
      />
      <PartLogModal
        workOrderId={wo.id}
        open={openModal === 'part_log'}
        onClose={() => setOpenModal(null)}
      />
      <FixFlowAssistDrawer
        open={assistOpen}
        onClose={() => setAssistOpen(false)}
        workOrder={wo}
      />
    </div>
  )
}
