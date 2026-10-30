class NotifyRequesterJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    work_order = WorkOrder.find_by(id: work_order_id)
    return unless work_order

    if work_order.requester
      # A person with an account chooses; someone who reported through the public form has no account to choose in.
      WorkOrderMailer.verified(work_order).deliver_later if work_order.requester.wants_email?("wo_verified")
      work_order.requester.push!("wo_verified", title: "Done: #{work_order.work_order_number}", body: work_order.title.to_s,
                                                path: "/work-orders/#{work_order.id}")
    elsif work_order.requester_email.present?
      WorkOrderMailer.verified_public(work_order).deliver_later
    end
  end
end
