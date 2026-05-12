class NotifyRequesterJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    work_order = WorkOrder.find_by(id: work_order_id)
    return unless work_order

    if work_order.requester
      WorkOrderMailer.verified(work_order).deliver_later
    elsif work_order.requester_email.present?
      WorkOrderMailer.verified_public(work_order).deliver_later
    end
  end
end
