# What the company's other systems are told about a work order (see Webhooks), after the change is saved for good: that it
# was made, and each change of status.
module WorkOrderWebhooks
  extend ActiveSupport::Concern

  STATUS_EVENTS = {
    "assigned" => "work_order.assigned", "in_progress" => "work_order.started", "on_hold" => "work_order.on_hold",
    "pending_parts" => "work_order.pending_parts", "completed" => "work_order.completed", "verified" => "work_order.verified",
    "cancelled" => "work_order.cancelled"
  }.freeze

  included do
    after_create_commit { Webhooks.work_order(self, "work_order.created") }
    after_update_commit :send_status_webhook, if: :saved_change_to_status?
  end

  private

  def send_status_webhook
    event = STATUS_EVENTS[status]
    Webhooks.work_order(self, event, changes: { status: saved_change_to_status }) if event
  end
end
