import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { moveRequest } from '@/lib/scheduleView'
import type { RescheduleInput, Schedule, ScheduledOrder } from '@/types/schedule'

const LABEL = 'mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300'
const SELECT =
  'flex h-9 w-full rounded-md border border-gray-300 bg-white px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100'

interface MoveModalProps {
  order: ScheduledOrder
  schedule: Schedule
  saving: boolean
  onClose: () => void
  onSave: (input: RescheduleInput) => void
}

/** Moving a work order without dragging it: for a phone, a keyboard, or a long way to drag. */
export function MoveModal({ order, schedule, saving, onClose, onSave }: MoveModalProps) {
  const [person, setPerson] = useState(order.assignee_id === null ? '' : String(order.assignee_id))
  const [day, setDay] = useState(order.day ?? schedule.today)

  const input = moveRequest(order, person === '' ? null : Number(person), day)

  return (
    <Modal open onClose={onClose} title={`Move ${order.work_order_number}`} description={order.title}>
      <div className="space-y-3">
        <div>
          <label htmlFor="move-person" className={LABEL}>Who does it</label>
          <select id="move-person" className={SELECT} value={person} onChange={(e) => setPerson(e.target.value)}>
            <option value="">Nobody yet</option>
            {schedule.technicians.map((row) => <option key={row.id} value={row.id!}>{row.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="move-day" className={LABEL}>Due on</label>
          <Input id="move-day" type="date" value={day} onChange={(e) => setDay(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => input && onSave(input)} loading={saving} disabled={!input || !day}>Move</Button>
        </div>
      </div>
    </Modal>
  )
}
