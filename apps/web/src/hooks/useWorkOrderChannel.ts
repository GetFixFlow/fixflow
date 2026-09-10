import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { WO_KEY } from './useWorkOrders'
import { useAuthStore } from '@/stores/authStore'

type WOChannelEvent =
  | { type: 'work_order_assigned'; work_order_id: number; assignee_id: number }
  | { type: 'work_order_updated'; work_order_id: number }
  | { type: 'work_order_completed'; work_order_id: number }
  | { type: 'work_order_verified'; work_order_id: number }

// Subscribes to ActionCable work_order_channel and handles real-time updates
export function useWorkOrderChannel() {
  const qc = useQueryClient()
  const { user, token } = useAuthStore()

  useEffect(() => {
    if (!token || !user) return

    let subscription: { unsubscribe: () => void } | null = null

    const connect = async () => {
      try {
        const { createConsumer } = await import('@rails/actioncable')
        const cable = createConsumer(
          `${import.meta.env.VITE_WS_URL ?? 'ws://localhost:3000'}/cable?token=${token}`,
        )

        subscription = cable.subscriptions.create('WorkOrderChannel', {
          received(data: WOChannelEvent) {
            qc.invalidateQueries({ queryKey: WO_KEY })

            if (data.type === 'work_order_assigned' && data.assignee_id === user.id) {
              toast.info(`A work order was assigned to you.`, {
                action: {
                  label: 'View',
                  onClick: () => {
                    window.location.href = `/work-orders/${data.work_order_id}`
                  },
                },
              })
            }

            if (data.type === 'work_order_verified') {
              qc.invalidateQueries({ queryKey: [...WO_KEY, data.work_order_id] })
            }
          },
        })
      } catch {
        // ActionCable not available in test/SSR environments
      }
    }

    connect()
    return () => subscription?.unsubscribe()
  }, [qc, token, user])
}
