class NotifyAssigneeJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    work_order = WorkOrder.find_by(id: work_order_id)
    return unless work_order&.assignee

    WorkOrderMailer.assigned(work_order).deliver_later
  end
end
