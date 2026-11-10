import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { PurchaseStatusBadge } from '@/components/purchasing/PurchaseStatusBadge'
import { PurchaseRequestModal } from '@/components/purchasing/PurchaseRequestModal'
import {
  useApprovePurchaseOrder, useCancelOrder, useCloseOrder, usePlaceOrder, usePurchaseOrder, useReceiveOrder, useRejectPurchaseOrder,
} from '@/hooks/usePurchaseOrders'
import { useActiveVendors } from '@/hooks/useVendors'
import { formatDate, formatDateTime, formatMoney } from '@/lib/localeFormat'
import type { PurchaseOrder } from '@/types'

const fieldClass =
  'w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

type Panel = 'reject' | 'order' | 'receive' | null

interface PurchaseOrderModalProps {
  id: number
  onClose: () => void
  canManage: boolean
  /** The signed-in person's id: whoever asked can change or cancel the request while it waits. */
  userId?: number
}

/** One request or order: what is on it, where it has got to, and the next step for whoever may take it. */
export function PurchaseOrderModal({ id, onClose, canManage, userId }: PurchaseOrderModalProps) {
  const { t } = useTranslation()
  const { data: order, isLoading, isError } = usePurchaseOrder(id)
  const [panel, setPanel] = useState<Panel>(null)
  const [editing, setEditing] = useState(false)

  if (editing && order) return <PurchaseRequestModal order={order} canPrice={canManage} onClose={() => setEditing(false)} />

  return (
    <Modal open onClose={onClose} title={order ? order.number : t('purchasing.order.fallback_title')} className="max-w-2xl">
      {isLoading ? (
        <Skeleton className="h-40 w-full" />
      ) : isError || !order ? (
        <p className="text-sm text-gray-500">{t('purchasing.order.load_failed')}</p>
      ) : (
        <Details order={order} panel={panel} setPanel={setPanel} canManage={canManage} userId={userId} onEdit={() => setEditing(true)} />
      )}
    </Modal>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  )
}

interface DetailsProps {
  order: PurchaseOrder
  panel: Panel
  setPanel: (panel: Panel) => void
  canManage: boolean
  userId?: number
  onEdit: () => void
}

function Details({ order, panel, setPanel, canManage, userId, onEdit }: DetailsProps) {
  const { t } = useTranslation()
  const approve = useApprovePurchaseOrder(order.id)
  const cancel = useCancelOrder(order.id)
  const close = useCloseOrder(order.id)
  const lines = order.lines ?? []
  const mine = order.requested_by?.id === userId
  const waiting = order.status === 'requested'
  const canChange = order.editable && (canManage || (mine && waiting))
  const canCancel = canManage ? ['requested', 'approved', 'ordered'].includes(order.status) : mine && waiting
  const inbound = order.status === 'ordered' || order.status === 'partially_received'

  const askCancel = () => {
    if (confirm(t('purchasing.order.confirm_cancel', { number: order.number }))) cancel.mutate(undefined)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <PurchaseStatusBadge status={order.status} />
        <span className="text-sm text-gray-500">{t('purchasing.order.asked_by', { name: order.requested_by?.name ?? t('purchasing.order.someone'), date: formatDate(order.created_at) })}</span>
      </div>

      {order.reason && <p className="text-sm text-gray-700 dark:text-gray-300">{order.reason}</p>}
      {order.status === 'rejected' && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-200">
          {order.decided_by
            ? t('purchasing.order.rejected_by', { name: order.decided_by.name, reason: order.rejection_reason })
            : t('purchasing.order.rejected', { reason: order.rejection_reason })}
        </p>
      )}

      <dl className="grid grid-cols-2 gap-3">
        {order.vendor && <Fact label={t('purchasing.order.vendor')}>{order.vendor.name}</Fact>}
        {order.supplier_reference && <Fact label={t('purchasing.order.their_reference')}>{order.supplier_reference}</Fact>}
        {order.expected_on && <Fact label={t('purchasing.order.expected')}>{formatDate(order.expected_on)}</Fact>}
        {order.decided_by && order.status !== 'rejected' && order.decided_at && (
          <Fact label={t('purchasing.order.approved')}>{order.decided_by.name}, {formatDateTime(order.decided_at)}</Fact>
        )}
        {order.received_at && <Fact label={t('purchasing.order.received')}>{formatDateTime(order.received_at)}</Fact>}
      </dl>

      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              {['part', 'wanted', 'received', 'each', 'total'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">{t(`purchasing.order.col_${h}`)}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {lines.map((line) => (
              <tr key={line.id}>
                <td className="px-3 py-2 font-medium">{line.part_name}</td>
                <td className="px-3 py-2">{line.quantity} {line.unit}</td>
                <td className="px-3 py-2">{line.quantity_received}</td>
                <td className="px-3 py-2">{line.unit_cost != null ? formatMoney(line.unit_cost) : '—'}</td>
                <td className="px-3 py-2">{line.total != null ? formatMoney(line.total) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} className="px-3 py-2 text-right text-xs font-semibold uppercase text-gray-500">{t('purchasing.order.total')}</td>
              <td className="px-3 py-2 font-semibold">{formatMoney(order.total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {panel === 'reject' && <RejectForm order={order} onDone={() => setPanel(null)} />}
      {panel === 'order' && <OrderForm order={order} onDone={() => setPanel(null)} />}
      {panel === 'receive' && <ReceiveForm order={order} onDone={() => setPanel(null)} />}

      {panel === null && (
        <div className="flex flex-wrap justify-end gap-2">
          {canChange && <Button variant="outline" size="sm" onClick={onEdit}>{t('purchasing.order.change')}</Button>}
          {canCancel && <Button variant="outline" size="sm" onClick={askCancel} disabled={cancel.isPending}>{waiting ? t('purchasing.order.cancel_request') : t('purchasing.order.cancel_order')}</Button>}
          {canManage && waiting && (
            <>
              <Button variant="outline" size="sm" onClick={() => setPanel('reject')}>{t('purchasing.order.turn_down')}</Button>
              <Button size="sm" onClick={() => approve.mutate(undefined)} disabled={approve.isPending}>{t('purchasing.order.approve')}</Button>
            </>
          )}
          {canManage && order.status === 'approved' && <Button size="sm" onClick={() => setPanel('order')}>{t('purchasing.order.place_order')}</Button>}
          {canManage && order.status === 'partially_received' && (
            <Button variant="outline" size="sm" onClick={() => close.mutate(undefined)} disabled={close.isPending}>{t('purchasing.order.nothing_more')}</Button>
          )}
          {canManage && inbound && <Button size="sm" onClick={() => setPanel('receive')}>{t('purchasing.order.record_delivery')}</Button>}
        </div>
      )}
    </div>
  )
}

function RejectForm({ order, onDone }: { order: PurchaseOrder; onDone: () => void }) {
  const { t } = useTranslation()
  const reject = useRejectPurchaseOrder(order.id)
  const [reason, setReason] = useState('')
  return (
    <form
      className="space-y-2" noValidate
      onSubmit={(e) => { e.preventDefault(); if (reason.trim()) reject.mutate(reason.trim(), { onSuccess: onDone }) }}
    >
      <label htmlFor="po-reject" className="block text-sm font-medium text-gray-700 dark:text-gray-300">{t('purchasing.order.why_turned_down')}</label>
      <textarea id="po-reject" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>{t('purchasing.order.back')}</Button>
        <Button type="submit" size="sm" disabled={!reason.trim() || reject.isPending}>{t('purchasing.order.turn_down')}</Button>
      </div>
    </form>
  )
}

function OrderForm({ order, onDone }: { order: PurchaseOrder; onDone: () => void }) {
  const { t } = useTranslation()
  const place = usePlaceOrder(order.id)
  const { data: vendors = [] } = useActiveVendors()
  const [vendorId, setVendorId] = useState(order.vendor_id ? String(order.vendor_id) : '')
  const [expected, setExpected] = useState(order.expected_on ?? '')
  const [reference, setReference] = useState(order.supplier_reference ?? '')
  return (
    <form
      className="space-y-3" noValidate
      onSubmit={(e) => {
        e.preventDefault()
        if (!vendorId) return
        place.mutate(
          { vendor_id: Number(vendorId), expected_on: expected || null, supplier_reference: reference.trim() || null },
          { onSuccess: onDone },
        )
      }}
    >
      <div>
        <label htmlFor="po-vendor" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('purchasing.order.order_from')}</label>
        <select id="po-vendor" value={vendorId} onChange={(e) => setVendorId(e.target.value)} className={fieldClass}>
          <option value="">{t('purchasing.order.choose_vendor')}</option>
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="po-expected" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('purchasing.order.expected_on')}</label>
          <input id="po-expected" type="date" value={expected} onChange={(e) => setExpected(e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="po-reference" className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{t('purchasing.order.their_number')}</label>
          <input id="po-reference" value={reference} onChange={(e) => setReference(e.target.value)} className={fieldClass} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>{t('purchasing.order.back')}</Button>
        <Button type="submit" size="sm" disabled={!vendorId || place.isPending}>{t('purchasing.order.mark_ordered')}</Button>
      </div>
    </form>
  )
}

function ReceiveForm({ order, onDone }: { order: PurchaseOrder; onDone: () => void }) {
  const { t } = useTranslation()
  const receive = useReceiveOrder(order.id)
  const lines = (order.lines ?? []).filter((line) => line.quantity_received < line.quantity)
  const [counts, setCounts] = useState<Record<number, string>>(
    () => Object.fromEntries(lines.map((line) => [line.id, String(Number((line.quantity - line.quantity_received).toFixed(2)))])),
  )
  const arrived = lines.filter((line) => Number(counts[line.id]) > 0).map((line) => ({ id: line.id, quantity: Number(counts[line.id]) }))
  return (
    <form
      className="space-y-3" noValidate
      onSubmit={(e) => { e.preventDefault(); if (arrived.length) receive.mutate(arrived, { onSuccess: onDone }) }}
    >
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('purchasing.order.how_many_arrived')}</p>
      {lines.map((line) => (
        <label key={line.id} className="flex items-center justify-between gap-3 text-sm">
          <span>{line.part_name} <span className="text-xs text-gray-400">{t('purchasing.order.still_to_come', { count: line.quantity - line.quantity_received })}</span></span>
          <input
            type="number" min="0" step="any" value={counts[line.id] ?? ''} aria-label={t('purchasing.order.arrived_aria', { name: line.part_name })}
            onChange={(e) => setCounts((all) => ({ ...all, [line.id]: e.target.value }))}
            className={`${fieldClass} w-28`}
          />
        </label>
      ))}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onDone}>{t('purchasing.order.back')}</Button>
        <Button type="submit" size="sm" disabled={arrived.length === 0 || receive.isPending}>{t('purchasing.order.add_to_stock')}</Button>
      </div>
    </form>
  )
}
