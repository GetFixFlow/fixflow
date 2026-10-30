class NotifyManagerJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    work_order = WorkOrder.find_by(id: work_order_id)
    return unless work_order

    managers = work_order.organization.users.managers
    managers.wanting_email("wo_needs_verification").each do |manager|
      WorkOrderMailer.needs_verification(work_order, manager).deliver_later
    end
    managers.each do |manager|
      manager.push!("wo_needs_verification", title: "Ready to verify: #{work_order.work_order_number}", body: work_order.title.to_s,
                                             path: "/work-orders/#{work_order.id}")
    end
  end
end
