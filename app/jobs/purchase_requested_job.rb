# Tells the managers and admins that someone has asked for parts and it is waiting for a decision.
class PurchaseRequestedJob < ApplicationJob
  queue_as :notifications

  def perform(purchase_order_id)
    order = ActsAsTenant.without_tenant { PurchaseOrder.find_by(id: purchase_order_id) }
    return unless order&.requested?

    who = order.requested_by&.full_name.presence || "Someone"
    body = "#{who} asked for #{order.lines.size} #{'part'.pluralize(order.lines.size)}"
    ChatNotifier.post(order.organization, "po_requested", title: "#{order.number} needs a decision", body: body, path: "/purchasing")
    managers = order.organization.users.managers.where.not(id: order.requested_by_id)
    managers.wanting_email("po_requested").each do |manager|
      PurchaseOrderMailer.requested(manager, order).deliver_later
    end
    managers.each do |manager|
      manager.push!("po_requested", title: "Parts requested: #{order.number}", body: body, path: "/purchasing")
    end
  end
end
