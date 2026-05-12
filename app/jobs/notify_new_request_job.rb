class NotifyNewRequestJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    work_order = WorkOrder.find_by(id: work_order_id)
    return unless work_order

    work_order.organization.users.managers.each do |manager|
      WorkOrderMailer.new_request(work_order, manager).deliver_later
    end
  end
end
