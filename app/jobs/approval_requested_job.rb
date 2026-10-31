# Tells the managers and administrators that a work order is over the approval limit and waiting for a decision. Not the
# person doing the work: they cannot approve it.
class ApprovalRequestedJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    order = ActsAsTenant.without_tenant { WorkOrder.find_by(id: work_order_id) }
    return unless order&.approval_requested_at && order.approval_needed?

    title = "#{order.work_order_number} needs approval"
    ChatNotifier.post(order.organization, "wo_approval_needed", title: title, body: order.title.to_s, path: "/work-orders/#{order.id}")
    managers = order.organization.users.managers.where.not(id: order.assignee_id)
    managers.wanting_email("wo_approval_needed").each do |manager|
      WorkOrderMailer.approval_needed(order, manager).deliver_later
    end
    managers.each do |manager|
      manager.push!("wo_approval_needed", title: title, body: order.title.to_s, path: "/work-orders/#{order.id}")
    end
  end
end
