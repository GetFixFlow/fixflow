class NotifyAssigneeJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    work_order = WorkOrder.find_by(id: work_order_id)
    return unless work_order&.assignee&.wants_email?("wo_assigned")

    WorkOrderMailer.assigned(work_order).deliver_later
  end
end
