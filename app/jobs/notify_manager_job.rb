class NotifyManagerJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    work_order = WorkOrder.find_by(id: work_order_id)
    return unless work_order

    work_order.organization.users.managers.wanting_email("wo_needs_verification").each do |manager|
      WorkOrderMailer.needs_verification(work_order, manager).deliver_later
    end
  end
end
