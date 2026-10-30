class NotifyAssigneeJob < ApplicationJob
  queue_as :notifications

  def perform(work_order_id)
    work_order = WorkOrder.find_by(id: work_order_id)
    return unless work_order&.assignee

    assignee = work_order.assignee
    WorkOrderMailer.assigned(work_order).deliver_later if assignee.wants_email?("wo_assigned")
    assignee.push!("wo_assigned", title: "Assigned to you: #{work_order.work_order_number}", body: work_order.title.to_s,
                                  path: "/work-orders/#{work_order.id}")
    ChatNotifier.post(work_order.organization, "wo_assigned",
                      title: "#{work_order.work_order_number} assigned to #{assignee.full_name}", body: work_order.title.to_s,
                      path: "/work-orders/#{work_order.id}")
  end
end
